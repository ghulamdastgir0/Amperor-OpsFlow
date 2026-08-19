import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing)
      throw new ConflictException(
        'A user with this email already exists in the tenant',
      );

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
        department: dto.department,
        slackUserId: dto.slackUserId,
      },
    });
    return this.sanitize(user);
  }

  async findAll(tenantId: string) {
    const users = await this.prisma.user.findMany({ where: { tenantId } });
    return users.map((u) => this.sanitize(u));
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async findByEmail(tenantId: string, email: string) {
    return this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
  }

  async findBySlackUserId(tenantId: string, slackUserId: string) {
    return this.prisma.user.findFirst({ where: { tenantId, slackUserId } });
  }

  // Links an existing password-based user to the Slack identity that just
  // completed "Add to Slack", so future "Continue with Slack" sign-ins (and
  // re-installs) resolve to the same account instead of finding no match.
  async linkSlackUserId(id: string, slackUserId: string) {
    return this.prisma.user.update({ where: { id }, data: { slackUserId } });
  }

  async remove(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
  }

  // Used by Slack OAuth (install or sign-in) to create a user that
  // authenticates via Slack only (no password) — the "Add to Slack"
  // installer becomes SYSTEM_ADMIN; a workspace member self-provisioning via
  // "Continue with Slack" becomes EMPLOYEE.
  async createSlackUser(
    tenantId: string,
    data: { email: string; name: string; slackUserId: string; role: Role },
  ) {
    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        slackUserId: data.slackUserId,
        role: data.role,
        passwordHash: null,
      },
    });
  }

  private sanitize(user: {
    passwordHash: string | null;
    [key: string]: unknown;
  }) {
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }
}
