import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

export interface RequestChangedPayload {
  id: string;
  status: string;
}

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.gateway.server?.to(this.gateway.userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    for (const id of new Set(userIds)) this.emitToUser(id, event, payload);
  }

  // `request.changed` is a signal, not data: id + status only (never
  // rawPrompt), fanned out to the tenant's staff room, the requester's own
  // room, and any extra user rooms (e.g. routed-role holders). Clients
  // re-fetch through the RBAC-filtered REST endpoints, so the socket never
  // widens what anyone can see.
  emitRequestChanged(
    tenantId: string,
    payload: RequestChangedPayload,
    opts: { requesterId?: string; extraUserIds?: string[] } = {},
  ): void {
    const server = this.gateway.server;
    if (!server) return;

    server
      .to(this.gateway.staffRoom(tenantId))
      .emit('request.changed', payload);

    const userIds = new Set<string>(opts.extraUserIds ?? []);
    if (opts.requesterId) userIds.add(opts.requesterId);
    for (const id of userIds) {
      server.to(this.gateway.userRoom(id)).emit('request.changed', payload);
    }
  }
}
