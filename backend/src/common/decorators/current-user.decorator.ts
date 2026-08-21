import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
}

// Platform-admin JWTs carry no tenantId/role at all — a distinct shape,
// deliberately not unioned into AuthenticatedUser (see JwtAuthGuard).
export interface PlatformAdminPayload {
  adminId: string;
  email: string;
  kind: 'platform_admin';
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  platformAdmin?: PlatformAdminPayload;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);

export const CurrentPlatformAdmin = createParamDecorator(
  (data: keyof PlatformAdminPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.platformAdmin?.[data] : request.platformAdmin;
  },
);
