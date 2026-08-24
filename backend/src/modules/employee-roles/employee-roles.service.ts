import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Role, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PoliciesService } from '../policies/policies.service';
import { LlmService } from '../llm/llm.service';
import { CreateEmployeeRoleDto } from './dto/create-employee-role.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { AssignEmployeeRolesDto } from './dto/assign-employee-roles.dto';
import { SendBroadcastDto } from './dto/send-broadcast.dto';

interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
}

// create() doesn't return nested relations by default — this matches what
// listBroadcasts() includes, so both the freshly-created and later-listed
// shape are the same for the frontend.
const BROADCAST_INCLUDE = {
  sender: { select: { id: true, name: true, email: true } },
  targets: { include: { employeeRole: { select: { id: true, name: true } } } },
} as const;

// Display labels for the fixed platform Role enum, used only for the
// forwarded-to-admin message text (mirrors the frontend's ROLE_LABELS).
const FIXED_ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ADMIN: 'System Admin',
  DEPARTMENT_MANAGER: 'Department Manager',
  TEAM_LEAD: 'Team Lead',
  FINANCE_APPROVER: 'Finance Approver',
  EMPLOYEE: 'Employee',
};

@Injectable()
export class EmployeeRolesService {
  private readonly logger = new Logger(EmployeeRolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly policies: PoliciesService,
    private readonly llm: LlmService,
  ) {}

  // Grounds a role's description in the tenant's actual policy documents
  // instead of relying on an admin to describe it well by hand — since
  // that description is exactly what the assistant later reads to decide
  // which role a filed request should route to. Retrieved chunks can each be
  // up to ~1500 chars of raw markdown (tables, headers included) — joining
  // them directly produced unreadable, multi-thousand-char text that blew
  // past the 300-char description limit and failed to save. Summarize with
  // the LLM into one short plain-prose sentence instead.
  async suggestDescription(
    tenantId: string,
    roleName: string,
  ): Promise<{ description: string | null }> {
    // This endpoint is SYSTEM_ADMIN-only (see the controller), so full access
    // is correct here — an admin describing a role catalog entry should be
    // able to draw on restricted policy content too.
    const clauses = await this.policies.findRelevantClauses(
      tenantId,
      roleName,
      Role.SYSTEM_ADMIN,
    );
    if (clauses.length === 0) return { description: null };

    const context = clauses.map((c) => c.clauseSnippet).join('\n\n---\n\n');
    try {
      const summary = await this.llm.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  `Based only on the policy excerpts below, write ONE short, plain-prose sentence ` +
                  `(no markdown, no bullet points, no headings, under 220 characters) describing what ` +
                  `the "${roleName}" role/department is responsible for. This will be shown to an AI ` +
                  `agent deciding which role a request should route to, so be concrete and specific.\n\n` +
                  `Policy excerpts:\n${context}`,
              },
            ],
          },
        ],
      });
      return { description: this.clampDescription(summary) };
    } catch (error) {
      this.logger.warn(
        `Failed to summarize description for role "${roleName}": ${(error as Error).message}`,
      );
      // Fall back to a hard-truncated raw snippet rather than failing the suggestion outright.
      return { description: this.clampDescription(clauses[0].clauseSnippet) };
    }
  }

  private clampDescription(text: string): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
  }

  async list(tenantId: string) {
    const roles = await this.prisma.employeeRole.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    return roles.map(({ _count, ...role }) => ({
      ...role,
      memberCount: _count.members,
    }));
  }

  async create(tenantId: string, dto: CreateEmployeeRoleDto) {
    const existing = await this.prisma.employeeRole.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) {
      throw new BadRequestException('A role with this name already exists');
    }
    const role = await this.prisma.employeeRole.create({
      data: { tenantId, name: dto.name, description: dto.description },
    });
    return { ...role, memberCount: 0 };
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeRoleDto) {
    const role = await this.prisma.employeeRole.findFirst({
      where: { id, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.employeeRole.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing) {
        throw new BadRequestException('A role with this name already exists');
      }
    }

    const updated = await this.prisma.employeeRole.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { _count: { select: { members: true } } },
    });
    const { _count, ...rest } = updated;
    return { ...rest, memberCount: _count.members };
  }

  async remove(tenantId: string, id: string) {
    const role = await this.prisma.employeeRole.findFirst({
      where: { id, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found');
    await this.prisma.employeeRole.delete({ where: { id } });
  }

  async getUserRoles(tenantId: string, userId: string) {
    await this.requireUser(tenantId, userId);
    const assignments = await this.prisma.userEmployeeRole.findMany({
      where: { userId },
      include: { employeeRole: true },
    });
    return assignments.map((a) => a.employeeRole);
  }

  async setUserRoles(
    tenantId: string,
    userId: string,
    dto: AssignEmployeeRolesDto,
  ) {
    await this.requireUser(tenantId, userId);

    if (dto.employeeRoleIds.length > 0) {
      const count = await this.prisma.employeeRole.count({
        where: { id: { in: dto.employeeRoleIds }, tenantId },
      });
      if (count !== dto.employeeRoleIds.length) {
        throw new BadRequestException('One or more roles were not found');
      }
    }

    await this.prisma.$transaction([
      this.prisma.userEmployeeRole.deleteMany({ where: { userId } }),
      this.prisma.userEmployeeRole.createMany({
        data: dto.employeeRoleIds.map((employeeRoleId) => ({
          userId,
          employeeRoleId,
        })),
      }),
    ]);

    return this.getUserRoles(tenantId, userId);
  }

  async listBroadcasts(tenantId: string) {
    return this.prisma.roleBroadcast.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: BROADCAST_INCLUDE,
    });
  }

  async broadcast(tenantId: string, senderId: string, dto: SendBroadcastDto) {
    const employeeRoleIds = dto.employeeRoleIds ?? [];
    const fixedRoles = dto.roles ?? [];
    if (employeeRoleIds.length === 0 && fixedRoles.length === 0) {
      throw new BadRequestException('Pick at least one role to send to.');
    }

    const employeeRoles = employeeRoleIds.length
      ? await this.prisma.employeeRole.findMany({
          where: { id: { in: employeeRoleIds }, tenantId },
        })
      : [];
    if (employeeRoles.length !== employeeRoleIds.length) {
      throw new BadRequestException('One or more roles were not found');
    }

    const botToken = await this.resolveBotToken(tenantId);
    if (!botToken) {
      throw new BadRequestException(
        'This tenant is not connected to Slack, so messages cannot be delivered yet.',
      );
    }

    // Two independent targeting axes, unioned: the tenant's custom
    // EmployeeRole catalog (HR, IT Support, ...) and the fixed platform Role
    // enum (Employee, Finance Approver, System Admin, ...) — a user matching
    // either is a recipient.
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        slackUserId: { not: null },
        OR: [
          ...(employeeRoleIds.length
            ? [{ employeeRoles: { some: { employeeRoleId: { in: employeeRoleIds } } } }]
            : []),
          ...(fixedRoles.length ? [{ role: { in: fixedRoles } }] : []),
        ],
      },
    });

    const targetLabel = [
      ...employeeRoles.map((r) => r.name),
      ...fixedRoles.map((r) => FIXED_ROLE_LABELS[r]),
    ].join(', ');

    if (recipients.length > 0) {
      await this.deliverToAll(botToken, recipients, dto.message);
      const created = await this.prisma.roleBroadcast.create({
        data: {
          tenantId,
          senderId,
          message: dto.message,
          recipientCount: recipients.length,
          forwardedToAdmin: false,
          // Only the EmployeeRole side of the target selection is
          // representable here — RoleBroadcastTarget FKs to EmployeeRole,
          // not the fixed Role enum (no UI currently surfaces this history,
          // so the fixed-role portion of the target is only reflected in
          // the delivered message/label, not persisted structurally).
          targets: {
            create: employeeRoleIds.map((employeeRoleId) => ({
              employeeRoleId,
            })),
          },
        },
        include: BROADCAST_INCLUDE,
      });
      return { ...created, deliveredToAdmin: false };
    }

    // Nobody reachable matches any of the target roles — forward to the
    // tenant's admins instead of letting the message disappear silently.
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: Role.SYSTEM_ADMIN,
        slackUserId: { not: null },
      },
    });
    if (admins.length === 0) {
      throw new BadRequestException(
        'No one matches the selected role(s), and no admin has a linked Slack account to forward it to.',
      );
    }

    const forwardedText = `:warning: No one currently matches the role(s) "${targetLabel}" — forwarding this message to you as admin:\n\n${dto.message}`;
    await this.deliverToAll(botToken, admins, forwardedText);

    const created = await this.prisma.roleBroadcast.create({
      data: {
        tenantId,
        senderId,
        message: dto.message,
        recipientCount: admins.length,
        forwardedToAdmin: true,
        targets: {
          create: employeeRoleIds.map((employeeRoleId) => ({
            employeeRoleId,
          })),
        },
      },
      include: BROADCAST_INCLUDE,
    });
    return { ...created, deliveredToAdmin: true };
  }

  // Best-effort, LLM-triggered routing: when the assistant's file_request
  // tool decides a filed request matches one of this tenant's roles (e.g. a
  // leave request matching "Human Resources (HR)"), notify that role's
  // members — same delivery + admin-fallback as a manual broadcast, but
  // never throws, since a notification failure shouldn't fail the request
  // the employee just filed.
  async notifyRoleForRequest(
    tenantId: string,
    roleName: string,
    input: {
      requesterId: string;
      requestId: string;
      intentType: string;
      rawPrompt: string;
    },
  ): Promise<{ delivered: boolean }> {
    try {
      const role = await this.prisma.employeeRole.findFirst({
        where: { tenantId, name: { equals: roleName, mode: 'insensitive' } },
      });
      if (!role) {
        this.logger.warn(
          `No employee role named "${roleName}" for tenant ${tenantId} — skipping auto-route`,
        );
        return { delivered: false };
      }

      const botToken = await this.resolveBotToken(tenantId);
      if (!botToken) return { delivered: false };

      const requester = await this.prisma.user.findUnique({
        where: { id: input.requesterId },
        select: { name: true },
      });
      const intentLabel = input.intentType.replace(/_/g, ' ').toLowerCase();
      const text = `New ${intentLabel} from ${requester?.name ?? 'an employee'}: "${input.rawPrompt}" (ref \`${input.requestId}\`)`;

      const roleHolders = await this.prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          slackUserId: { not: null },
          employeeRoles: { some: { employeeRoleId: role.id } },
        },
      });
      // Anyone holding this role but currently on approved leave is skipped
      // — falls through to the SYSTEM_ADMIN fallback below exactly like
      // "nobody holds this role" already does, rather than paging someone
      // who isn't there to see it. Applies to every role the same way (HR,
      // IT, or any future one) since this runs before the fallback check
      // regardless of which role was targeted. The requester themselves is
      // also excluded even if they hold this role — deciding your own
      // request is a conflict of interest (RequestsService.decideRoleStage
      // blocks it server-side too; this just stops them being pinged about
      // it in the first place).
      const onLeaveIds = await this.getUsersOnLeave(
        tenantId,
        roleHolders.map((u) => u.id),
      );
      const recipients = roleHolders.filter(
        (u) => !onLeaveIds.has(u.id) && u.id !== input.requesterId,
      );

      const target =
        recipients.length > 0
          ? recipients
          : await this.prisma.user.findMany({
              where: {
                tenantId,
                isActive: true,
                role: Role.SYSTEM_ADMIN,
                slackUserId: { not: null },
              },
            });
      if (target.length === 0) {
        this.logger.warn(
          `No one reachable for role "${roleName}" or as admin fallback in tenant ${tenantId}`,
        );
        return { delivered: false };
      }

      const forwardedToAdmin = recipients.length === 0;
      const forwardReason =
        roleHolders.length === 0
          ? `No one currently holds the role "${role.name}"`
          : `No one holding the role "${role.name}" is available to review this`;
      await this.deliverToAll(
        botToken,
        target,
        forwardedToAdmin
          ? `:warning: ${forwardReason} — forwarding this message to you as admin:\n\n${text}`
          : text,
      );

      await this.prisma.roleBroadcast.create({
        data: {
          tenantId,
          senderId: input.requesterId,
          message: text,
          recipientCount: target.length,
          forwardedToAdmin,
          targets: { create: [{ employeeRoleId: role.id }] },
        },
      });
      return { delivered: true };
    } catch (error) {
      this.logger.warn(
        `Auto-routing to role "${roleName}" failed: ${(error as Error).message}`,
      );
      return { delivered: false };
    }
  }

  // Which of these users currently has an approved leave request covering
  // today — see Request.leaveStartDate/leaveEndDate. Only leave requests
  // ever populate those columns, so no separate intentType filter is needed.
  private async getUsersOnLeave(
    tenantId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const onLeave = await this.prisma.request.findMany({
      where: {
        tenantId,
        requesterId: { in: userIds },
        status: RequestStatus.APPROVED,
        leaveStartDate: { lte: today },
        leaveEndDate: { gte: today },
      },
      select: { requesterId: true },
    });
    return new Set(onLeave.map((r) => r.requesterId));
  }

  private async resolveBotToken(tenantId: string): Promise<string | undefined> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    return tenant?.slackBotToken ?? this.config.get<string>('slack.botToken');
  }

  private async deliverToAll(
    botToken: string,
    recipients: { slackUserId: string | null }[],
    text: string,
  ) {
    for (const recipient of recipients) {
      if (!recipient.slackUserId) continue;
      await firstValueFrom(
        this.httpService.post<SlackPostMessageResponse>(
          'https://slack.com/api/chat.postMessage',
          { channel: recipient.slackUserId, text },
          { headers: { Authorization: `Bearer ${botToken}` } },
        ),
      );
    }
  }

  private async requireUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
