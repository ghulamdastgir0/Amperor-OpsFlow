import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  requestId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // Best-effort — mirrors RequestsService.notify* posture: persisting/emitting
  // a notification must never fail the action that triggered it.
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      const row = await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          kind: input.kind,
          title: input.title,
          body: input.body,
          requestId: input.requestId,
        },
      });
      this.realtime.emitToUser(input.userId, 'notification.new', row);
    } catch (error) {
      this.logger.warn(
        `Failed to create notification for ${input.userId}: ${(error as Error).message}`,
      );
    }
  }

  async createMany(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<void> {
    await Promise.all(
      [...new Set(userIds)].map((userId) => this.create({ ...input, userId })),
    );
  }

  listForUser(
    userId: string,
    opts: { unreadOnly?: boolean; take?: number } = {},
  ) {
    return this.prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 30,
    });
  }

  async markRead(userId: string, id: string): Promise<{ ok: true }> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      // Not theirs / doesn't exist / already read — only the first two are
      // errors; an already-read row is a no-op success.
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { ok: true };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
