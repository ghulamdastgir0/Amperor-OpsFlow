import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformAdminOnly } from '../../common/decorators/platform-admin.decorator';
import { CurrentPlatformAdmin } from '../../common/decorators/current-user.decorator';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { UpdatePlatformAdminProfileDto } from './dto/update-platform-admin-profile.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { PlatformAdminService } from './platform-admin.service';

// Platform-admin plane: entirely separate identity/auth from tenant users
// (see JwtAuthGuard's `kind: 'platform_admin'` check) — not part of the
// tenant-facing Swagger surface.
@ApiTags('Platform')
@ApiExcludeController()
@Controller('platform')
@PlatformAdminOnly()
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Public()
  @Post('auth/login')
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAdminService.login(dto);
  }

  @Get('tenants')
  listTenants() {
    return this.platformAdminService.listTenants();
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.platformAdminService.createTenant(dto);
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.platformAdminService.getTenant(id);
  }

  @Patch('tenants/:id/block')
  block(@Param('id') id: string) {
    return this.platformAdminService.setActive(id, false);
  }

  @Patch('tenants/:id/unblock')
  unblock(@Param('id') id: string) {
    return this.platformAdminService.setActive(id, true);
  }

  @Delete('tenants/:id')
  deleteTenant(@Param('id') id: string) {
    return this.platformAdminService.deleteTenant(id);
  }

  @Get('tenants/:id/users')
  getTenantUsers(@Param('id') id: string) {
    return this.platformAdminService.getTenantUsers(id);
  }

  @Post('tenants/:id/admin-user')
  createTenantAdmin(
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
  ) {
    return this.platformAdminService.createTenantAdmin(id, dto);
  }

  @Delete('tenants/:id/users/:userId')
  deleteTenantAdmin(
    @CurrentPlatformAdmin('adminId') adminId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.platformAdminService.deleteTenantAdmin(adminId, id, userId);
  }

  @Patch('tenants/:id/users/:userId/block')
  blockTenantUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.platformAdminService.setTenantUserActive(id, userId, false);
  }

  @Patch('tenants/:id/users/:userId/unblock')
  unblockTenantUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.platformAdminService.setTenantUserActive(id, userId, true);
  }

  @Get('tenants/:id/requests')
  getTenantRequests(@Param('id') id: string) {
    return this.platformAdminService.getTenantRequests(id);
  }

  @Get('tenants/:id/budgets')
  getTenantBudgets(@Param('id') id: string) {
    return this.platformAdminService.getTenantBudgetDashboard(id);
  }

  @Get('admins/me')
  getMyProfile(@CurrentPlatformAdmin('adminId') adminId: string) {
    return this.platformAdminService.getProfile(adminId);
  }

  @Patch('admins/me')
  updateMyProfile(
    @CurrentPlatformAdmin('adminId') adminId: string,
    @Body() dto: UpdatePlatformAdminProfileDto,
  ) {
    return this.platformAdminService.updateProfile(adminId, dto);
  }

  @Get('admins')
  listAdmins(@CurrentPlatformAdmin('adminId') adminId: string) {
    return this.platformAdminService.listAdmins(adminId);
  }

  @Post('admins')
  createAdmin(
    @CurrentPlatformAdmin('adminId') adminId: string,
    @Body() dto: CreatePlatformAdminDto,
  ) {
    return this.platformAdminService.createAdmin(adminId, dto);
  }

  @Patch('admins/:id/block')
  blockAdmin(
    @CurrentPlatformAdmin('adminId') adminId: string,
    @Param('id') id: string,
  ) {
    return this.platformAdminService.setAdminActive(adminId, id, false);
  }

  @Patch('admins/:id/unblock')
  unblockAdmin(
    @CurrentPlatformAdmin('adminId') adminId: string,
    @Param('id') id: string,
  ) {
    return this.platformAdminService.setAdminActive(adminId, id, true);
  }

  @Delete('admins/:id')
  deleteAdmin(
    @CurrentPlatformAdmin('adminId') adminId: string,
    @Param('id') id: string,
  ) {
    return this.platformAdminService.deleteAdmin(adminId, id);
  }
}
