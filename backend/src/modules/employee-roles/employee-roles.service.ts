import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PoliciesService } from '../policies/policies.service';
import { CreateEmployeeRoleDto } from './dto/create-employee-role.dto';
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

@Injectable()
export class EmployeeRolesService {
  private readonly logger = new Logger(EmployeeRolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly policies: PoliciesService,
  ) {}

  // Grounds a role's description in the tenant's actual policy documents
  // instead of relying on an admin to describe it well by hand — since
  // that description is exactly what the assistant later reads to decide
  // which role a filed request should route to.
  async suggestDescription(
    tenantId: string,
    roleName: string,
  ): Promise<{ description: string | null }> {
    const clauses = await this.policies.findRelevantClauses(tenantId, roleName);
    if (clauses.length === 0) return { description: null };
    return { description: clauses.map((c) => c.clauseSnippet).join(' ') };
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
    const roles = await this.prisma.employeeRole.findMany({
      where: { id: { in: dto.employeeRoleIds }, tenantId },
    });
    if (roles.length !== dto.employeeRoleIds.length) {
      throw new BadRequestException('One or more roles were not found');
    }

    const botToken = await this.resolveBotToken(tenantId);
    if (!botToken) {
      throw new BadRequestException(
        'This tenant is not connected to Slack, so messages cannot be delivered yet.',
      );
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        slackUserId: { not: null },
        employeeRoles: {
          some: { employeeRoleId: { in: dto.employeeRoleIds } },
        },
      },
    });

    if (recipients.length > 0) {
      await this.deliverToAll(botToken, recipients, dto.message);
      const created = await this.prisma.roleBroadcast.create({
        data: {
          tenantId,
          senderId,
          message: dto.message,
          recipientCount: recipients.length,
          forwardedToAdmin: false,
          targets: {
            create: dto.employeeRoleIds.map((employeeRoleId) => ({
              employeeRoleId,
            })),
          },
        },
        include: BROADCAST_INCLUDE,
      });
      return { ...created, deliveredToAdmin: false };
    }

    // Nobody reachable holds any of the target roles — forward to the
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
        'No employee holds the selected role(s), and no admin has a linked Slack account to forward it to.',
      );
    }

    const roleNames = roles.map((r) => r.name).join(', ');
    const forwardedText = `:warning: No one currently holds the role(s) "${roleNames}" — forwarding this message to you as admin:\n\n${dto.message}`;
    await this.deliverToAll(botToken, admins, forwardedText);

    const created = await this.prisma.roleBroadcast.create({
      data: {
        tenantId,
        senderId,
        message: dto.message,
        recipientCount: admins.length,
        forwardedToAdmin: true,
        targets: {
          create: dto.employeeRoleIds.map((employeeRoleId) => ({
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

      const recipients = await this.prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          slackUserId: { not: null },
          employeeRoles: { some: { employeeRoleId: role.id } },
        },
      });

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
      await this.deliverToAll(
        botToken,
        target,
        forwardedToAdmin
          ? `:warning: No one currently holds the role "${role.name}" — forwarding this message to you as admin:\n\n${text}`
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
