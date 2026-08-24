import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDepartmentDto } from './dto/update-user-department.dto';

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
    await this.assignAllRolesIfAdmin(tenantId, user.id, user.role);
    return this.sanitize(user);
  }

  async findAll(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: { employeeRoles: { include: { employeeRole: true } } },
    });
    return users.map((u) => {
      const { employeeRoles, ...rest } = u;
      return {
        ...this.sanitize(rest),
        employeeRoles: employeeRoles.map(
          (assignment) => assignment.employeeRole,
        ),
      };
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  // Same shape as findAll's per-row mapping (employeeRoles resolved, not just
  // join-table ids) so the profile page gets exactly what the employee table
  // shows for everyone else about themselves.
  async getProfile(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { employeeRoles: { include: { employeeRole: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const { employeeRoles, ...rest } = user;
    return {
      ...this.sanitize(rest),
      employeeRoles: employeeRoles.map((assignment) => assignment.employeeRole),
    };
  }

  // Self-service update of the profile fields a user can change about
  // themselves — deliberately excludes `role`, which only updateRole (admin-
  // only, and never on your own account) can touch.
  async updateProfile(tenantId: string, userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: dto.email } },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException(
          'That email is already in use in this tenant',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, email: dto.email, department: dto.department },
    });
    return this.sanitize(updated);
  }

  // A Slack-only user (passwordHash null) has nothing to confirm, so
  // currentPassword is only required once a password already exists —
  // otherwise this doubles as "set a password for the first time."
  async changePassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.passwordHash) {
      const matches =
        !!dto.currentPassword &&
        (await bcrypt.compare(dto.currentPassword, user.passwordHash));
      if (!matches) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  // Only lets a user drop their own Slack link if they can still log in
  // afterward — never leave a Slack-only account with no way to authenticate.
  async unlinkSlack(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Set a password before unlinking Slack, or you won’t be able to sign in',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { slackUserId: null },
    });
    return this.sanitize(updated);
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

  // Changes an existing employee's access role (permission level) — distinct
  // from EmployeeRole department tags, which only affect message routing.
  async updateRole(
    tenantId: string,
    actingUserId: string,
    targetUserId: string,
    role: Role,
  ) {
    if (targetUserId === actingUserId) {
      throw new BadRequestException("You can't change your own access role");
    }
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });
    await this.assignAllRolesIfAdmin(tenantId, updated.id, updated.role);
    return this.sanitize(updated);
  }

  // Only a SYSTEM_ADMIN can fix another employee's department — an employee
  // who never set their own (most notably anyone auto-provisioned via Slack,
  // see SlackService.resolveOrProvisionRequesterId) previously had no way to
  // get one assigned short of editing their own profile themselves. This
  // matters beyond a display field: Request.requester.department is what
  // FinanceDelegation matching keys off of.
  async updateDepartment(
    tenantId: string,
    targetUserId: string,
    dto: UpdateUserDepartmentDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { department: dto.department || null },
    });
    return this.sanitize(updated);
  }

  async remove(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
  }

  // Reusable, no self-check baked in — "self" is only meaningful from a
  // tenant user's own perspective (UsersController checks that before
  // calling this); Platform Admin has no "self" concept against a tenant
  // employee, so it calls this directly.
  async setActive(tenantId: string, targetUserId: string, isActive: boolean) {
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
    });
    return this.sanitize(updated);
  }

  // Hard delete, only when there's nothing to lose — an employee with no
  // history anywhere they're referenced by id. Every one of those foreign
  // keys is RESTRICT, not CASCADE, by design (see AGENTS.md: losing audit
  // records when a user is deleted is the actual bug, not the constraint),
  // so a real employee's history can't be silently destroyed; this just
  // turns that into a clear message instead of a raw constraint-violation
  // error. Anyone with real history should be blocked (setActive false)
  // instead, which preserves the audit trail.
  async removeEmployee(
    tenantId: string,
    actingUserId: string,
    targetUserId: string,
  ) {
    if (targetUserId === actingUserId) {
      throw new BadRequestException("You can't remove your own account");
    }
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const [
      requestCount,
      approvalCount,
      auditLogCount,
      delegationCount,
      broadcastCount,
    ] = await Promise.all([
      this.prisma.request.count({ where: { requesterId: targetUserId } }),
      this.prisma.approval.count({ where: { approverId: targetUserId } }),
      this.prisma.auditLog.count({ where: { actorId: targetUserId } }),
      this.prisma.financeDelegation.count({
        where: {
          OR: [
            { grantedByAdminId: targetUserId },
            { delegateManagerId: targetUserId },
          ],
        },
      }),
      this.prisma.roleBroadcast.count({ where: { senderId: targetUserId } }),
    ]);
    if (
      requestCount > 0 ||
      approvalCount > 0 ||
      auditLogCount > 0 ||
      delegationCount > 0 ||
      broadcastCount > 0
    ) {
      throw new BadRequestException(
        "This employee has request, approval, or other history and can't be removed — block their account instead to preserve the audit trail.",
      );
    }

    await this.prisma.user.delete({ where: { id: targetUserId } });
  }

  // Used by Slack OAuth (install or sign-in) to create a user that
  // authenticates via Slack only (no password) — the "Add to Slack"
  // installer becomes SYSTEM_ADMIN; a workspace member self-provisioning via
  // "Continue with Slack" becomes EMPLOYEE.
  async createSlackUser(
    tenantId: string,
    data: { email: string; name: string; slackUserId: string; role: Role },
  ) {
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        slackUserId: data.slackUserId,
        role: data.role,
        passwordHash: null,
      },
    });
    await this.assignAllRolesIfAdmin(tenantId, user.id, user.role);
    return user;
  }

  // A new SYSTEM_ADMIN starts covering every department tag that already
  // exists — otherwise they'd hold none until someone manually edits their
  // roles, and role-targeted broadcasts/routing would never reach them.
  private async assignAllRolesIfAdmin(
    tenantId: string,
    userId: string,
    role: Role,
  ) {
    if (role !== Role.SYSTEM_ADMIN) return;
    const roles = await this.prisma.employeeRole.findMany({
      where: { tenantId },
      select: { id: true },
    });
    if (roles.length === 0) return;
    await this.prisma.userEmployeeRole.createMany({
      data: roles.map((r) => ({ userId, employeeRoleId: r.id })),
      skipDuplicates: true,
    });
  }

  // Strips passwordHash before anything reaches the client, replacing it with
  // hasPassword — every self/admin-facing response goes through this so the
  // profile page can always tell "change password" (current password
  // required) apart from "set password" (Slack-only account, nothing to
  // confirm), regardless of which endpoint produced the response.
  private sanitize(user: {
    passwordHash: string | null;
    [key: string]: unknown;
  }) {
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: passwordHash != null };
  }
}
