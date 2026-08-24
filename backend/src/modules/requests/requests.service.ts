import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  ApprovalDecision,
  AttachmentSource,
  ExecutionStepStatus,
  Prisma,
  Role,
  RequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PoliciesService,
  RESTRICTED_DOC_VISIBLE_ROLES,
} from '../policies/policies.service';
import { FinanceDelegationsService } from '../finance-delegations/finance-delegations.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OcrService } from '../slack/ocr.service';
import { BudgetsService } from '../budgets/budgets.service';
import { StorageService } from '../../common/storage/storage.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { randomUUID } from 'crypto';

// Finance/Admin may decide a request whose amount is *stated* (chat text,
// unverified) without any FinanceDelegation matching it — delegation
// matching stays required only for a *verified* (attachment-derived)
// amount. See decideFinanceStage.
const FINANCE_DECIDE_ROLES = new Set<Role>([
  Role.FINANCE_APPROVER,
  Role.SYSTEM_ADMIN,
]);

// storagePath is deliberately excluded here — the actual proof-image bytes
// live in GCS and are only fetched via getAttachmentFile, so normal
// request-detail reads never need to touch storage at all.
const DETAIL_INCLUDE = {
  attachments: {
    select: {
      id: true,
      requestId: true,
      source: true,
      slackFileId: true,
      urlPrivateDownload: true,
      fileName: true,
      mimeType: true,
      merchantName: true,
      totalAmount: true,
      currency: true,
      lineItems: true,
      taxId: true,
      documentDate: true,
      ocrRawText: true,
      createdAt: true,
    },
  },
  executionSteps: { orderBy: { sequenceOrder: 'asc' as const } },
  policyCitations: { include: { policyDocument: true } },
  approvals: true,
};

const MANAGER_ROLES = new Set<Role>([
  Role.DEPARTMENT_MANAGER,
  Role.TEAM_LEAD,
  Role.SYSTEM_ADMIN,
]);

// Same "flat, tenant-wide approval authority" set as MANAGER_ROLES plus
// FINANCE_APPROVER — anyone in it may see any request; everyone else only
// their own. Mirrors AssistantService's identical set for the same reason.
const BROAD_VISIBILITY_ROLES = new Set<Role>([
  ...MANAGER_ROLES,
  Role.FINANCE_APPROVER,
]);

type FinalDecision =
  typeof ApprovalDecision.APPROVED | typeof ApprovalDecision.REJECTED;

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly financeDelegations: FinanceDelegationsService,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly ocr: OcrService,
    private readonly budgets: BudgetsService,
    private readonly storage: StorageService,
  ) {}

  async create(tenantId: string, requesterId: string, dto: CreateRequestDto) {
    const routedRole = dto.routeToRoleName
      ? await this.prisma.employeeRole.findFirst({
          where: {
            tenantId,
            name: { equals: dto.routeToRoleName, mode: 'insensitive' },
          },
        })
      : null;

    const request = await this.prisma.request.create({
      data: {
        tenantId,
        requesterId,
        channel: dto.channel,
        rawPrompt: dto.rawPrompt,
        parsedIntent: dto.parsedIntent ?? 'UNCLASSIFIED',
        status: RequestStatus.PENDING_POLICY_CHECK,
        statedAmount: dto.statedAmount,
        budgetDepartment: dto.budgetDepartment,
        routedRoleId: routedRole?.id,
        requiresApproval: routedRole ? dto.requiresApproval : undefined,
        leaveStartDate: dto.leaveStartDate
          ? new Date(dto.leaveStartDate)
          : undefined,
        leaveEndDate: dto.leaveEndDate ? new Date(dto.leaveEndDate) : undefined,
      },
    });

    // Seed the Live Execution Timeline (FR-UI-002)
    await this.prisma.executionStep.create({
      data: {
        requestId: request.id,
        stepName: 'Checking Policy...',
        sequenceOrder: 1,
        status: ExecutionStepStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    return request;
  }

  // Any user holding the EmployeeRole a request was routed to (see
  // decideRoleStage) can see/act on it too, on top of the fixed-Role
  // BROAD_VISIBILITY_ROLES check below — EmployeeRole membership is
  // per-tenant data, not part of the Role enum, so it has to be a DB lookup
  // rather than a static set.
  private async getHeldRoleIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.userEmployeeRole.findMany({
      where: { userId },
      select: { employeeRoleId: true },
    });
    return memberships.map((m) => m.employeeRoleId);
  }

  // A plain EMPLOYEE only ever sees their own requests here — this app's
  // approval roles (MANAGER_ROLES minus SYSTEM_ADMIN, plus FINANCE_APPROVER)
  // are tenant-wide, not department-scoped, so anyone holding one is already
  // trusted to review any request at that stage; an EMPLOYEE is not. Was
  // previously unfiltered (any authenticated user saw every request in the
  // tenant) — real gap, fixed 2026-08-20.
  async findAll(
    tenantId: string,
    actingUser: { userId: string; role: Role },
    status?: RequestStatus,
  ) {
    const canSeeAll = BROAD_VISIBILITY_ROLES.has(actingUser.role);
    const heldRoleIds = canSeeAll
      ? []
      : await this.getHeldRoleIds(actingUser.userId);
    return this.prisma.request.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(canSeeAll
          ? {}
          : {
              OR: [
                { requesterId: actingUser.userId },
                ...(heldRoleIds.length > 0
                  ? [{ routedRoleId: { in: heldRoleIds } }]
                  : []),
              ],
            }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    id: string,
    actingUser: { userId: string; role: Role },
  ) {
    const request = await this.prisma.request.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!request) throw new NotFoundException('Request not found');
    if (
      request.requesterId !== actingUser.userId &&
      !BROAD_VISIBILITY_ROLES.has(actingUser.role) &&
      !(
        request.routedRoleId &&
        (await this.getHeldRoleIds(actingUser.userId)).includes(
          request.routedRoleId,
        )
      )
    ) {
      throw new ForbiddenException("You don't have access to this request");
    }
    // Same restricted-document filtering as AssistantService.getPolicyCitations
    // — DETAIL_INCLUDE embeds policyCitations directly, so without this, this
    // endpoint would bypass that check entirely for the same underlying data.
    if (!RESTRICTED_DOC_VISIBLE_ROLES.has(actingUser.role)) {
      request.policyCitations = request.policyCitations.filter(
        (c) => !c.policyDocument.restricted,
      );
    }
    return request;
  }

  async updateStatus(tenantId: string, id: string, status: RequestStatus) {
    const request = await this.prisma.request.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return this.prisma.request.update({ where: { id }, data: { status } });
  }

  // Policy Matching + Approval Routing (SRS Section 5.1, steps 5-6). Call once a Request
  // has whatever attachments it's going to have (immediately for text-only requests, after
  // Slack file ingestion finishes for attachment requests).
  async runPipeline(tenantId: string, requestId: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, tenantId },
      include: { attachments: true },
    });
    if (!request) throw new NotFoundException('Request not found');

    await this.completeStep(requestId, 'Checking Policy...');

    // This is the system checking policy compliance, not the requester
    // directly querying — use full access (SYSTEM_ADMIN) so a restricted
    // policy is still matched/cited internally even for a request filed by
    // an unprivileged employee. Restriction is enforced at read time instead
    // (AssistantService.getPolicyCitations, gated by the *viewer's* role),
    // so a later Finance Approver reviewing the same request still sees it,
    // while the original requester viewing their own request does not.
    const citations = await this.policies.findRelevantClauses(
      tenantId,
      request.rawPrompt,
      Role.SYSTEM_ADMIN,
    );
    for (const citation of citations) {
      await this.prisma.policyCitation.create({
        data: {
          requestId,
          policyDocumentId: citation.policyDocumentId,
          clauseSnippet: citation.clauseSnippet,
          relevanceScore: citation.relevanceScore,
        },
      });
    }

    const totalAmount = this.sumAttachments(request.attachments);

    await this.addStep(
      requestId,
      'Routing for Approval',
      ExecutionStepStatus.COMPLETED,
    );

    if (totalAmount <= 0) {
      const stated = Number(request.statedAmount ?? 0);
      if (stated > 0) {
        // No verified receipt, but a dollar figure was stated in chat —
        // route straight to Finance/Admin (skip the manager stage; this
        // tenant only actually uses Employee/Finance Approver/System Admin)
        // to reserve the amount pending proof, instead of silently
        // auto-completing with no decision at all.
        await this.addStep(
          requestId,
          'Awaiting Finance Approval',
          ExecutionStepStatus.IN_PROGRESS,
        );
        return this.setStatus(
          requestId,
          RequestStatus.PENDING_FINANCE_APPROVAL,
        );
      }

      // No dollar amount at all — this isn't an expense flow. If it was
      // routed to an EmployeeRole (leave request -> HR, etc.), that role's
      // holders decide it for real (or, for a pure FYI like "ask IT about
      // the wifi password"), it's just logged — instead of every $0 request
      // silently auto-completing with no decision ever made, regardless of
      // what it actually was.
      if (request.routedRoleId) {
        if (request.requiresApproval) {
          await this.addStep(
            requestId,
            'Awaiting Role Approval',
            ExecutionStepStatus.IN_PROGRESS,
          );
          return this.setStatus(requestId, RequestStatus.PENDING_ROLE_APPROVAL);
        }
        await this.addStep(
          requestId,
          'Logged — No Approval Needed',
          ExecutionStepStatus.COMPLETED,
        );
        return this.setStatus(requestId, RequestStatus.NOTED);
      }

      // No role matched at all (routeToRoleName omitted or didn't match any
      // configured EmployeeRole) — escalate to a system admin rather than
      // silently auto-completing with nobody ever having looked at it.
      await this.addStep(
        requestId,
        'Escalated — No Matching Role',
        ExecutionStepStatus.IN_PROGRESS,
      );
      return this.setStatus(requestId, RequestStatus.ESCALATED);
    }

    await this.addStep(
      requestId,
      'Awaiting Manager Approval',
      ExecutionStepStatus.IN_PROGRESS,
    );
    return this.setStatus(requestId, RequestStatus.PENDING_MANAGER_APPROVAL);
  }

  // Manager / Finance / Escalation decision, tying FinanceDelegation thresholds to the
  // request's actual spend amount.
  async decide(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    decision: FinalDecision,
    reason?: string,
  ) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, tenantId },
      include: { attachments: true, requester: true },
    });
    if (!request) throw new NotFoundException('Request not found');

    const totalAmount = this.sumAttachments(request.attachments);
    // Verified (attachment/OCR) amount takes priority; otherwise fall back
    // to the unverified stated amount so delegation-matching and the
    // recorded Approval.spendingAmount still reflect the real figure being
    // decided on, even before a receipt exists.
    const effectiveAmount =
      totalAmount > 0 ? totalAmount : Number(request.statedAmount ?? 0);
    const hasVerifiedAttachment = request.attachments.length > 0;
    const department = request.requester.department ?? 'ALL';
    // Which Budget row this approval would actually draw down — the expense
    // category if the assistant classified one, not the requester's own
    // department (that's a separate concept, used only for delegation
    // matching above). See decideFinanceStage/decideEscalatedStage.
    const budgetScope =
      request.budgetDepartment ?? request.requester.department ?? 'ALL';

    let result;
    switch (request.status) {
      case RequestStatus.PENDING_MANAGER_APPROVAL:
        result = await this.decideManagerStage(
          tenantId,
          actingUser,
          request.id,
          department,
          effectiveAmount,
          decision,
          reason,
        );
        break;
      case RequestStatus.PENDING_FINANCE_APPROVAL:
        result = await this.decideFinanceStage(
          tenantId,
          actingUser,
          request.id,
          department,
          budgetScope,
          effectiveAmount,
          hasVerifiedAttachment,
          decision,
          reason,
        );
        break;
      case RequestStatus.ESCALATED:
        result = await this.decideEscalatedStage(
          tenantId,
          actingUser,
          request.id,
          budgetScope,
          effectiveAmount,
          decision,
          reason,
        );
        break;
      case RequestStatus.PENDING_ROLE_APPROVAL:
        result = await this.decideRoleStage(
          tenantId,
          actingUser,
          request.id,
          request.requesterId,
          request.routedRoleId!,
          decision,
          reason,
        );
        break;
      default:
        throw new ConflictException('Request is not awaiting approval');
    }

    // Best-effort — never lets a notification failure fail the decision itself.
    if (
      result.status === RequestStatus.APPROVED ||
      result.status === RequestStatus.REJECTED
    ) {
      await this.notifyRequesterOfDecision(
        tenantId,
        request.requester,
        result.status,
        request.rawPrompt,
      );
    }
    return result;
  }

  private async decideManagerStage(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    department: string,
    totalAmount: number,
    decision: FinalDecision,
    reason: string | undefined,
  ) {
    if (!MANAGER_ROLES.has(actingUser.role)) {
      throw new ForbiddenException(
        'Only a manager, team lead, or admin can act on this request',
      );
    }

    await this.recordApproval(
      requestId,
      actingUser.userId,
      decision,
      reason,
      totalAmount,
      false,
    );
    await this.completeStep(requestId, 'Awaiting Manager Approval');

    if (decision === ApprovalDecision.REJECTED) {
      await this.audit(
        tenantId,
        actingUser.userId,
        requestId,
        'REQUEST_REJECTED',
        { stage: 'manager' },
      );
      return this.setStatus(requestId, RequestStatus.REJECTED);
    }

    const covering = await this.coveringDelegations(
      tenantId,
      department,
      totalAmount,
    );

    await this.audit(
      tenantId,
      actingUser.userId,
      requestId,
      'REQUEST_MANAGER_APPROVED',
      {
        totalAmount,
        routedToFinance: covering.length > 0,
      },
    );

    if (covering.length > 0) {
      await this.addStep(
        requestId,
        'Awaiting Finance Approval',
        ExecutionStepStatus.IN_PROGRESS,
      );
      return this.setStatus(requestId, RequestStatus.PENDING_FINANCE_APPROVAL);
    }

    await this.addStep(
      requestId,
      'Escalated — No Finance Delegate Available',
      ExecutionStepStatus.IN_PROGRESS,
    );
    return this.setStatus(requestId, RequestStatus.ESCALATED);
  }

  private async decideFinanceStage(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    department: string,
    budgetScope: string,
    totalAmount: number,
    hasVerifiedAttachment: boolean,
    decision: FinalDecision,
    reason: string | undefined,
  ) {
    const covering = await this.coveringDelegations(
      tenantId,
      department,
      totalAmount,
    );
    const matched = covering.find(
      (d) => d.delegateManagerId === actingUser.userId,
    );

    // A verified (receipt-backed) amount still requires an actual matching
    // FinanceDelegation, or SYSTEM_ADMIN — unchanged, existing behavior. An
    // unverified/stated amount (no receipt yet — the "reserve now, prove
    // later" path) only requires holding FINANCE_APPROVER or SYSTEM_ADMIN;
    // requiring a pre-configured delegation for a not-yet-real number would
    // make the fallback ("if no finance manager exists, admin handles it")
    // impossible to satisfy in the common case of no delegations configured.
    const authorized = hasVerifiedAttachment
      ? !!matched || actingUser.role === Role.SYSTEM_ADMIN
      : FINANCE_DECIDE_ROLES.has(actingUser.role);

    if (!authorized) {
      throw new ForbiddenException(
        hasVerifiedAttachment
          ? 'No active finance delegation covers this amount for your account'
          : 'Only a Finance Approver or System Admin can act on this request',
      );
    }

    // Blocks (throws) if this would overdraw the department's remaining
    // budget; returns a warning string if it would use exactly what's left.
    // Applies to every approver equally, including System Admin — this is a
    // budget-integrity guard, not an authority check, so it isn't something
    // a higher role should be able to route around.
    const budgetWarning =
      decision === ApprovalDecision.APPROVED
        ? await this.checkBudgetHeadroom(tenantId, budgetScope, totalAmount)
        : undefined;

    await this.recordApproval(
      requestId,
      actingUser.userId,
      decision,
      reason,
      totalAmount,
      !!matched,
      matched?.id,
    );
    await this.completeStep(requestId, 'Awaiting Finance Approval');
    await this.audit(
      tenantId,
      actingUser.userId,
      requestId,
      `REQUEST_FINANCE_${decision}`,
      {
        totalAmount,
        delegationId: matched?.id,
      },
    );

    const updated = await this.setStatus(
      requestId,
      decision === ApprovalDecision.APPROVED
        ? RequestStatus.APPROVED
        : RequestStatus.REJECTED,
    );
    return budgetWarning ? { ...updated, budgetWarning } : updated;
  }

  private async decideEscalatedStage(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    budgetScope: string,
    totalAmount: number,
    decision: FinalDecision,
    reason: string | undefined,
  ) {
    if (actingUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only a system admin can resolve an escalated request',
      );
    }

    const budgetWarning =
      decision === ApprovalDecision.APPROVED
        ? await this.checkBudgetHeadroom(tenantId, budgetScope, totalAmount)
        : undefined;

    await this.recordApproval(
      requestId,
      actingUser.userId,
      decision,
      reason,
      totalAmount,
      false,
    );
    // Reached via two different escalation reasons ("no finance delegate
    // covers this amount" vs. "no matching role" — see runPipeline), each
    // with its own step name, so complete whichever one is actually still
    // in progress rather than hardcoding either name.
    await this.completeLatestInProgressStep(requestId);
    await this.audit(
      tenantId,
      actingUser.userId,
      requestId,
      `REQUEST_ESCALATION_${decision}`,
      {
        totalAmount,
      },
    );

    const updated = await this.setStatus(
      requestId,
      decision === ApprovalDecision.APPROVED
        ? RequestStatus.APPROVED
        : RequestStatus.REJECTED,
    );
    return budgetWarning ? { ...updated, budgetWarning } : updated;
  }

  // A shared queue, same shape as Manager/Finance above: any user holding
  // the routed EmployeeRole (or SYSTEM_ADMIN) can decide it — not a single
  // assigned owner. Everyone holding the role got notified when it was
  // filed (EmployeeRolesService.notifyRoleForRequest); whoever acts first
  // wins, and the status check at the top of decide() already stops a
  // second holder from double-deciding it.
  private async decideRoleStage(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    requesterId: string,
    routedRoleId: string,
    decision: FinalDecision,
    reason: string | undefined,
  ) {
    // A role-holder deciding their own request is a conflict of interest
    // (e.g. someone in HR filing their own leave request) — blocked even for
    // a SYSTEM_ADMIN, since the self-decide problem is orthogonal to role
    // authority. notifyRoleForRequest already excludes the requester from
    // who gets pinged for the same reason.
    if (actingUser.userId === requesterId) {
      throw new ForbiddenException(
        'You cannot decide your own request — another role-holder or a system admin needs to act on it',
      );
    }

    if (actingUser.role !== Role.SYSTEM_ADMIN) {
      const holdsRole = await this.prisma.userEmployeeRole.findFirst({
        where: { userId: actingUser.userId, employeeRoleId: routedRoleId },
      });
      if (!holdsRole) {
        throw new ForbiddenException(
          'Only someone holding the role this was routed to, or a system admin, can act on this request',
        );
      }
    }

    await this.recordApproval(
      requestId,
      actingUser.userId,
      decision,
      reason,
      0,
      false,
    );
    await this.completeStep(requestId, 'Awaiting Role Approval');
    await this.audit(
      tenantId,
      actingUser.userId,
      requestId,
      `REQUEST_ROLE_${decision}`,
      {
        routedRoleId,
      },
    );

    return this.setStatus(
      requestId,
      decision === ApprovalDecision.APPROVED
        ? RequestStatus.APPROVED
        : RequestStatus.REJECTED,
    );
  }

  // Finance/Admin closes out an APPROVED-but-unverified request (the
  // "reserve now, prove later" path — see runPipeline) by attaching the
  // actual receipt/invoice. This becomes a real Attachment row via the same
  // OCR pipeline Slack file ingestion uses, and moving the request to
  // COMPLETED is what makes BudgetsService count it as spent (its
  // "transaction" query already looks for status in [APPROVED, COMPLETED]
  // with an attachment carrying a real amount) — no separate budget-side
  // bookkeeping needed, it just falls out of the existing query once a real
  // attachment exists.
  async attachProof(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
  ) {
    if (!FINANCE_DECIDE_ROLES.has(actingUser.role)) {
      throw new ForbiddenException(
        'Only a Finance Approver or System Admin can attach proof',
      );
    }
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, tenantId },
      include: { attachments: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RequestStatus.APPROVED) {
      throw new BadRequestException(
        'Proof can only be attached to an approved request',
      );
    }
    if (request.attachments.length > 0) {
      throw new BadRequestException('This request already has proof attached');
    }

    const attachmentIds: string[] = [];
    for (const file of files) {
      const parsed = await this.ocr.extractFields(file.buffer, file.mimetype);
      const id = randomUUID();
      const storagePath = `attachments/${tenantId}/${requestId}/${id}-${file.originalname}`;
      await this.storage.upload(file.buffer, storagePath, file.mimetype);
      const attachment = await this.prisma.attachment.create({
        data: {
          id,
          requestId,
          source: AttachmentSource.assistant_ui,
          fileName: file.originalname,
          mimeType: file.mimetype,
          storagePath,
          merchantName: parsed.merchantName,
          // Deliberately NOT forced to request.statedAmount — this is a raw
          // record of what OCR found on this specific receipt (may be null,
          // e.g. a non-receipt image). BudgetsService treats the originally
          // reserved statedAmount as the authoritative spent figure once any
          // proof exists, rather than trusting per-file OCR totals, so the
          // reserved dollar amount always converts to spent regardless of
          // what OCR extracts here.
          totalAmount: parsed.totalAmount,
          currency: parsed.currency,
          lineItems: parsed.lineItems,
          taxId: parsed.taxId,
          documentDate: parsed.documentDate
            ? new Date(parsed.documentDate)
            : undefined,
          ocrRawText: parsed.rawText,
        },
      });
      attachmentIds.push(attachment.id);
    }

    await this.addStep(
      requestId,
      'Proof Attached — Reserved Funds Spent',
      ExecutionStepStatus.COMPLETED,
    );
    await this.audit(
      tenantId,
      actingUser.userId,
      requestId,
      'REQUEST_PROOF_ATTACHED',
      {
        attachmentIds,
        statedAmount: request.statedAmount ?? null,
      },
    );

    await this.setStatus(requestId, RequestStatus.COMPLETED);
    return this.findOne(tenantId, requestId, {
      userId: actingUser.userId,
      role: actingUser.role,
    });
  }

  // Streams a proof file's raw bytes back out — same visibility rule as
  // findOne (own request, or a BROAD_VISIBILITY_ROLES holder).
  async getAttachmentFile(
    tenantId: string,
    actingUser: { userId: string; role: Role },
    requestId: string,
    attachmentId: string,
  ) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, tenantId },
      select: { id: true, requesterId: true, routedRoleId: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (
      request.requesterId !== actingUser.userId &&
      !BROAD_VISIBILITY_ROLES.has(actingUser.role) &&
      !(
        request.routedRoleId &&
        (await this.getHeldRoleIds(actingUser.userId)).includes(
          request.routedRoleId,
        )
      )
    ) {
      throw new ForbiddenException("You don't have access to this request");
    }
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, requestId },
      select: { storagePath: true, mimeType: true, fileName: true },
    });
    if (!attachment?.storagePath) {
      throw new NotFoundException('File not found');
    }
    return attachment;
  }

  // Best-effort, never throws — a Slack DM failure must not fail the
  // decision itself. Only fires on a terminal outcome (APPROVED/REJECTED).
  private async notifyRequesterOfDecision(
    tenantId: string,
    requester: { id: string; name: string; slackUserId: string | null },
    status: typeof RequestStatus.APPROVED | typeof RequestStatus.REJECTED,
    rawPrompt: string,
  ) {
    try {
      if (!requester.slackUserId) return;
      const botToken = await this.resolveBotToken(tenantId);
      if (!botToken) return;

      const verb = status === RequestStatus.APPROVED ? 'approved' : 'rejected';
      const text = `Your request "${rawPrompt}" was ${verb}.`;
      await firstValueFrom(
        this.httpService.post(
          'https://slack.com/api/chat.postMessage',
          { channel: requester.slackUserId, text },
          { headers: { Authorization: `Bearer ${botToken}` } },
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify requester of decision: ${(error as Error).message}`,
      );
    }
  }

  private async resolveBotToken(tenantId: string): Promise<string | undefined> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    return tenant?.slackBotToken ?? this.config.get<string>('slack.botToken');
  }

  private async coveringDelegations(
    tenantId: string,
    department: string,
    totalAmount: number,
  ) {
    const delegations = await this.financeDelegations.findActiveForDepartment(
      tenantId,
      department,
    );
    return delegations.filter((d) => Number(d.maxApprovalLimit) >= totalAmount);
  }

  // Blocks an approval that would overdraw the department's remaining
  // budget (throws), or returns a warning string when it would use exactly
  // what's left. No-op (returns undefined, no error) when nothing is
  // configured for this scope — there's nothing to check against.
  private async checkBudgetHeadroom(
    tenantId: string,
    budgetScope: string,
    amount: number,
  ): Promise<string | undefined> {
    if (amount <= 0) return undefined;
    const remaining = await this.budgets.getRemainingForDepartment(
      tenantId,
      budgetScope,
    );
    if (remaining === null) return undefined;

    const EPSILON = 0.005; // guards against float rounding on Decimal->Number
    if (amount > remaining + EPSILON) {
      throw new BadRequestException(
        `This request ($${amount.toFixed(2)}) exceeds the remaining ${budgetScope} budget ` +
          `($${remaining.toFixed(2)}). It cannot be approved as-is.`,
      );
    }
    if (Math.abs(amount - remaining) <= EPSILON) {
      return `This approval uses the entire remaining ${budgetScope} budget ($${remaining.toFixed(2)}) — nothing will be left.`;
    }
    return undefined;
  }

  private sumAttachments(attachments: Array<{ totalAmount: unknown }>): number {
    return attachments.reduce(
      (sum, attachment) => sum + Number(attachment.totalAmount ?? 0),
      0,
    );
  }

  private setStatus(requestId: string, status: RequestStatus) {
    return this.prisma.request.update({
      where: { id: requestId },
      data: { status },
    });
  }

  private recordApproval(
    requestId: string,
    approverId: string,
    decision: FinalDecision,
    reason: string | undefined,
    spendingAmount: number,
    isDelegatedApproval: boolean,
    delegationId?: string,
  ) {
    return this.prisma.approval.create({
      data: {
        requestId,
        approverId,
        decision,
        decisionReason: reason,
        spendingAmount,
        isDelegatedApproval,
        delegationId,
        decidedAt: new Date(),
      },
    });
  }

  private async addStep(
    requestId: string,
    stepName: string,
    status: ExecutionStepStatus,
  ) {
    const last = await this.prisma.executionStep.findFirst({
      where: { requestId },
      orderBy: { sequenceOrder: 'desc' },
    });
    return this.prisma.executionStep.create({
      data: {
        requestId,
        stepName,
        status,
        sequenceOrder: (last?.sequenceOrder ?? 0) + 1,
        startedAt: new Date(),
        completedAt:
          status === ExecutionStepStatus.COMPLETED ? new Date() : undefined,
      },
    });
  }

  private async completeStep(requestId: string, stepName: string) {
    const step = await this.prisma.executionStep.findFirst({
      where: { requestId, stepName },
      orderBy: { sequenceOrder: 'desc' },
    });
    if (!step) return;
    return this.prisma.executionStep.update({
      where: { id: step.id },
      data: { status: ExecutionStepStatus.COMPLETED, completedAt: new Date() },
    });
  }

  private async completeLatestInProgressStep(requestId: string) {
    const step = await this.prisma.executionStep.findFirst({
      where: { requestId, status: ExecutionStepStatus.IN_PROGRESS },
      orderBy: { sequenceOrder: 'desc' },
    });
    if (!step) return;
    return this.prisma.executionStep.update({
      where: { id: step.id },
      data: { status: ExecutionStepStatus.COMPLETED, completedAt: new Date() },
    });
  }

  private audit(
    tenantId: string,
    actorId: string,
    requestId: string,
    action: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.auditLogs.record({
      tenantId,
      actorId,
      action,
      entityType: 'request',
      entityId: requestId,
      metadata,
    });
  }
}
