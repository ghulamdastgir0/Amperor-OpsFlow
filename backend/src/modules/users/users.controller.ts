import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserDepartmentDto } from './dto/update-user-department.dto';
import { UpdateUserTeamLeadDto } from './dto/update-user-team-lead.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(user.tenantId);
  }

  // Every role — not just SYSTEM_ADMIN — can view/edit their own profile.
  // Must be registered ahead of :id below, or Nest would match "me" as an id.
  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.tenantId, user.userId);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.tenantId, user.userId, dto);
  }

  @Patch('me/password')
  changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.tenantId, user.userId, dto);
  }

  @Delete('me/slack')
  unlinkMySlack(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.unlinkSlack(user.tenantId, user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.findOne(user.tenantId, id);
  }

  @Patch(':id/role')
  @Roles(Role.SYSTEM_ADMIN)
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(
      user.tenantId,
      user.userId,
      id,
      dto.role,
    );
  }

  @Patch(':id/department')
  @Roles(Role.SYSTEM_ADMIN)
  updateDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDepartmentDto,
  ) {
    return this.usersService.updateDepartment(user.tenantId, id, dto);
  }

  @Patch(':id/team-lead')
  @Roles(Role.SYSTEM_ADMIN)
  updateTeamLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserTeamLeadDto,
  ) {
    return this.usersService.setTeamLead(user.tenantId, id, dto);
  }

  // Immediate cutoff — see JwtAuthGuard, which re-checks isActive on every
  // request, not just at login.
  @Patch(':id/block')
  @Roles(Role.SYSTEM_ADMIN)
  block(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (id === user.userId) {
      throw new BadRequestException("You can't block your own account");
    }
    return this.usersService.setActive(user.tenantId, id, false);
  }

  @Patch(':id/unblock')
  @Roles(Role.SYSTEM_ADMIN)
  unblock(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.setActive(user.tenantId, id, true);
  }

  @Delete(':id')
  @Roles(Role.SYSTEM_ADMIN)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.removeEmployee(user.tenantId, user.userId, id);
  }
}
