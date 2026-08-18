import {
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

    const payload = {
      adminId: admin.id,
      email: admin.email,
      kind: 'platform_admin' as const,
    };
    return { accessToken: this.jwtService.sign(payload), admin: payload };
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
