import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_PLATFORM_ADMIN_KEY } from '../decorators/platform-admin.decorator';
import type {
  AuthenticatedUser,
  PlatformAdminPayload,
  RequestWithUser,
} from '../decorators/current-user.decorator';

type DecodedToken = AuthenticatedUser | PlatformAdminPayload;

function isPlatformAdminPayload(
  payload: DecodedToken,
): payload is PlatformAdminPayload {
  return (payload as PlatformAdminPayload).kind === 'platform_admin';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: DecodedToken;
    try {
      payload = this.jwtService.verify<DecodedToken>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const requiresPlatformAdmin = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    // A token kind can never be presented where the other is expected — this
    // is what actually keeps a platform-admin identity (no tenantId at all)
    // from ever reaching a tenant-scoped query as an accidental `undefined`,
    // which Prisma would otherwise treat as "no filter."
    if (requiresPlatformAdmin) {
      if (!isPlatformAdminPayload(payload)) {
        throw new UnauthorizedException('Platform admin token required');
      }
      // Immediate cutoff: a blocked admin's already-issued JWT stops working
      // on their very next request, not just at their next login.
      const admin = await this.prisma.platformAdmin.findUnique({
        where: { id: payload.adminId },
        select: { isActive: true },
      });
      if (!admin || !admin.isActive) {
        throw new ForbiddenException('This admin account has been blocked');
      }
      request.platformAdmin = payload;
      return true;
    }

    if (isPlatformAdminPayload(payload)) {
      throw new UnauthorizedException('Tenant token required');
    }

    // Immediate cutoff: a blocked tenant's already-issued JWTs stop working
    // on their very next request, not just at their next login.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { isActive: true },
    });
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('This tenant has been blocked');
    }

    // Immediate cutoff: a blocked employee's already-issued JWT stops
    // working on their very next request, not just at their next login.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      throw new ForbiddenException('This account has been blocked');
    }

    request.user = payload;
    return true;
  }

  private extractToken(request: RequestWithUser): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
