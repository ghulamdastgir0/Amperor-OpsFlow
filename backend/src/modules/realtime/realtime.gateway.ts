import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AuthenticatedUser,
  PlatformAdminPayload,
} from '../../common/decorators/current-user.decorator';

type DecodedToken = AuthenticatedUser | PlatformAdminPayload;

// Fixed roles trusted to see any request in the tenant (mirrors
// RequestsService.BROAD_VISIBILITY_ROLES). Only these join the tenant-wide
// "staff" room that request.changed signals broadcast to — a plain EMPLOYEE
// only ever receives events addressed to their own user room.
const STAFF_ROLES = new Set<Role>([
  Role.TEAM_LEAD,
  Role.DEPARTMENT_MANAGER,
  Role.FINANCE_APPROVER,
  Role.SYSTEM_ADMIN,
]);

export interface SocketUser {
  userId: string;
  tenantId: string;
  role: Role;
}

// CORS + the (optional) Redis adapter are applied by RealtimeIoAdapter in
// main.ts — nothing origin-specific is configurable at decorator-eval time.
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('missing token');

      const payload = this.jwt.verify<DecodedToken>(token);
      if (this.isPlatformAdmin(payload)) {
        throw new Error('platform admin token not allowed on this socket');
      }

      // Same immediate-cutoff checks as JwtAuthGuard: a blocked tenant or
      // account cannot hold a live socket, and role is re-read from the DB
      // since the JWT claim can be stale.
      const [tenant, dbUser] = await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: payload.tenantId },
          select: { isActive: true },
        }),
        this.prisma.user.findUnique({
          where: { id: payload.userId },
          select: { isActive: true, role: true },
        }),
      ]);
      if (!tenant?.isActive || !dbUser?.isActive) {
        throw new Error('account or tenant blocked');
      }

      const user: SocketUser = {
        userId: payload.userId,
        tenantId: payload.tenantId,
        role: dbUser.role,
      };
      (client.data as { user?: SocketUser }).user = user;
      await client.join(this.userRoom(user.userId));
      if (STAFF_ROLES.has(dbUser.role)) {
        await client.join(this.staffRoom(user.tenantId));
      }
    } catch (error) {
      this.logger.debug(
        `Rejected socket ${client.id}: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    // socket.io removes the client from its rooms automatically.
    void client;
  }

  userRoom(userId: string): string {
    return `user:${userId}`;
  }

  staffRoom(tenantId: string): string {
    return `tenant:${tenantId}:staff`;
  }

  private isPlatformAdmin(
    payload: DecodedToken,
  ): payload is PlatformAdminPayload {
    return (payload as PlatformAdminPayload).kind === 'platform_admin';
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token) return auth.token;
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken) return queryToken;
    return undefined;
  }
}
