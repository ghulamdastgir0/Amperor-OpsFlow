import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EmployeeRolesService } from './employee-roles.service';
import { CreateEmployeeRoleDto } from './dto/create-employee-role.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { AssignEmployeeRolesDto } from './dto/assign-employee-roles.dto';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { SuggestDescriptionDto } from './dto/suggest-description.dto';

// System-admin-only: assigning departmental tags to employees and sending
// them role-targeted Slack messages is an admin capability, not something
// employees manage or see for themselves.
@ApiTags('Employee Roles')
@ApiBearerAuth('access-token')
@Controller('employee-roles')
@Roles(Role.SYSTEM_ADMIN)
export class EmployeeRolesController {
  constructor(private readonly employeeRolesService: EmployeeRolesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.employeeRolesService.list(user.tenantId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeRoleDto,
  ) {
    return this.employeeRolesService.create(user.tenantId, dto);
  }

  @Post('suggest-description')
  suggestDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SuggestDescriptionDto,
  ) {
    return this.employeeRolesService.suggestDescription(
      user.tenantId,
      dto.name,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeRoleDto,
  ) {
    return this.employeeRolesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employeeRolesService.remove(user.tenantId, id);
  }

  @Get('users/:userId')
  getUserRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.employeeRolesService.getUserRoles(user.tenantId, userId);
  }

  @Patch('users/:userId')
  setUserRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: AssignEmployeeRolesDto,
  ) {
    return this.employeeRolesService.setUserRoles(user.tenantId, userId, dto);
  }

  @Get('broadcasts')
  listBroadcasts(@CurrentUser() user: AuthenticatedUser) {
    return this.employeeRolesService.listBroadcasts(user.tenantId);
  }

  @Post('broadcast')
  broadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendBroadcastDto,
  ) {
    return this.employeeRolesService.broadcast(user.tenantId, user.userId, dto);
  }
}
