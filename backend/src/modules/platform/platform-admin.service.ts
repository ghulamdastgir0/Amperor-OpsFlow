import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RequestsService } from '../requests/requests.service';
import { BudgetsService } from '../budgets/budgets.service';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { UpdatePlatformAdminProfileDto } from './dto/update-platform-admin-profile.dto';

const ADMIN_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  isGlobalAdmin: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly users: UsersService,
    private readonly requests: RequestsService,
    private readonly budgets: BudgetsService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: dto.email },
    });
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const matches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');
    if (!admin.isActive) {
      throw new UnauthorizedException('This admin account has been blocked');
    }

    const payload = {
      adminId: admin.id,
      email: admin.email,
      kind: 'platform_admin' as const,
    };
    return { accessToken: this.jwtService.sign(payload), admin: payload };
  }

  getProfile(adminId: string) {
    return this.requireAdmin(adminId);
  }

  async updateProfile(adminId: string, dto: UpdatePlatformAdminProfileDto) {
    await this.requireAdmin(adminId);

    if (dto.email) {
      const existing = await this.prisma.platformAdmin.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== adminId) {
        throw new ConflictException('That email is already in use');
      }
    }

    return this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: dto.password
          ? await bcrypt.hash(dto.password, 10)
          : undefined,
      },
      select: ADMIN_PROFILE_SELECT,
    });
  }

  async listAdmins(actingAdminId: string) {
    await this.requireGlobalAdmin(actingAdminId);
    return this.prisma.platformAdmin.findMany({
      orderBy: { createdAt: 'asc' },
      select: ADMIN_PROFILE_SELECT,
    });
  }

  async createAdmin(actingAdminId: string, dto: CreatePlatformAdminDto) {
    await this.requireGlobalAdmin(actingAdminId);

    const existing = await this.prisma.platformAdmin.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('That email is already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.platformAdmin.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        isGlobalAdmin: dto.isGlobalAdmin ?? false,
      },
      select: ADMIN_PROFILE_SELECT,
    });
  }

  async setAdminActive(actingAdminId: string, id: string, isActive: boolean) {
    await this.requireGlobalAdmin(actingAdminId);
    if (id === actingAdminId) {
      throw new BadRequestException("You can't block your own account");
    }
    await this.requireAdmin(id);
    return this.prisma.platformAdmin.update({
      where: { id },
      data: { isActive },
      select: ADMIN_PROFILE_SELECT,
    });
  }

  async deleteAdmin(actingAdminId: string, id: string) {
    await this.requireGlobalAdmin(actingAdminId);
    if (id === actingAdminId) {
      throw new BadRequestException("You can't delete your own account");
    }
    await this.requireAdmin(id);
    await this.prisma.platformAdmin.delete({ where: { id } });
  }

  private async requireAdmin(id: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id },
      select: ADMIN_PROFILE_SELECT,
    });
    if (!admin) throw new NotFoundException('Platform admin not found');
    return admin;
  }

  private async requireGlobalAdmin(id: string) {
    const admin = await this.requireAdmin(id);
    if (!admin.isGlobalAdmin) {
      throw new ForbiddenException('Only a global admin can do this');
    }
    return admin;
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, requests: true } } },
    });
    return tenants.map(({ _count, ...tenant }) => ({
      ...tenant,
      userCount: _count.users,
      requestCount: _count.requests,
    }));
  }

  createTenant(dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: dto });
  }

  async setActive(id: string, isActive: boolean) {
    await this.requireTenant(id);
    return this.prisma.tenant.update({ where: { id }, data: { isActive } });
  }

  async deleteTenant(id: string) {
    await this.requireTenant(id);
    return this.prisma.tenant.delete({ where: { id } });
  }

  async getTenantUsers(id: string) {
    await this.requireTenant(id);
    return this.users.findAll(id);
  }

  async getTenantRequests(id: string) {
    await this.requireTenant(id);
    return this.requests.findAll(id);
  }

  async getTenantBudgetDashboard(id: string) {
    await this.requireTenant(id);
    return this.budgets.getDashboard(id);
  }

  private async requireTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
