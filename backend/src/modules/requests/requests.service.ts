import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalDecision,
  ExecutionStepStatus,
  Prisma,
  Role,
  RequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PoliciesService } from '../policies/policies.service';
import { FinanceDelegationsService } from '../finance-delegations/finance-delegations.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateRequestDto } from './dto/create-request.dto';

const DETAIL_INCLUDE = {
  attachments: true,
  executionSteps: { orderBy: { sequenceOrder: 'asc' as const } },
  policyCitations: { include: { policyDocument: true } },
  approvals: true,
};

const MANAGER_ROLES = new Set<Role>([
  Role.DEPARTMENT_MANAGER,
  Role.TEAM_LEAD,
  Role.SYSTEM_ADMIN,
]);

type FinalDecision =
  typeof ApprovalDecision.APPROVED | typeof ApprovalDecision.REJECTED;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly financeDelegations: FinanceDelegationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(tenantId: string, requesterId: string, dto: CreateRequestDto) {
    const request = await this.prisma.request.create({
      data: {
        tenantId,
        requesterId,
        channel: dto.channel,
        rawPrompt: dto.rawPrompt,
        parsedIntent: dto.parsedIntent ?? 'UNCLASSIFIED',
        status: RequestStatus.PENDING_POLICY_CHECK,
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

  findAll(tenantId: string, status?: RequestStatus) {
    return this.prisma.request.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const request = await this.prisma.request.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async updateStatus(tenantId: string, id: string, status: RequestStatus) {
    await this.findOne(tenantId, id);
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

    const citations = await this.policies.findRelevantClauses(
      tenantId,
      request.rawPrompt,
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

    if (totalAmount <= 0) {
      await this.addStep(
        requestId,
        'Routing for Approval',
        ExecutionStepStatus.COMPLETED,
      );
      await this.addStep(requestId, 'Completed', ExecutionStepStatus.COMPLETED);
      return this.setStatus(requestId, RequestStatus.COMPLETED);
    }

    await this.addStep(
      requestId,
      'Routing for Approval',
      ExecutionStepStatus.COMPLETED,
    );
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
    const department = request.requester.department ?? 'ALL';

    switch (request.status) {
      case RequestStatus.PENDING_MANAGER_APPROVAL:
        return this.decideManagerStage(
          tenantId,
          actingUser,
          request.id,
          department,
          totalAmount,
          decision,
          reason,
        );
      case RequestStatus.PENDING_FINANCE_APPROVAL:
        return this.decideFinanceStage(
          tenantId,
          actingUser,
          request.id,
          department,
          totalAmount,
          decision,
          reason,
        );
      case RequestStatus.ESCALATED:
        return this.decideEscalatedStage(
          tenantId,
          actingUser,
          request.id,
          totalAmount,
          decision,
          reason,
        );
      default:
        throw new ConflictException('Request is not awaiting approval');
    }
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
    totalAmount: number,
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

    if (!matched && actingUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'No active finance delegation covers this amount for your account',
      );
    }

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

    return this.setStatus(
      requestId,
      decision === ApprovalDecision.APPROVED
        ? RequestStatus.APPROVED
        : RequestStatus.REJECTED,
    );
  }

  private async decideEscalatedStage(
    tenantId: string,
    actingUser: AuthenticatedUser,
    requestId: string,
    totalAmount: number,
    decision: FinalDecision,
    reason: string | undefined,
  ) {
    if (actingUser.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only a system admin can resolve an escalated request',
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
    await this.completeStep(
      requestId,
      'Escalated — No Finance Delegate Available',
    );
    await this.audit(
      tenantId,
      actingUser.userId,
      requestId,
      `REQUEST_ESCALATION_${decision}`,
      {
        totalAmount,
      },
    );

    return this.setStatus(
      requestId,
      decision === ApprovalDecision.APPROVED
        ? RequestStatus.APPROVED
        : RequestStatus.REJECTED,
    );
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
