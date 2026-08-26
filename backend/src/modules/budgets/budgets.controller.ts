import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { RenameBudgetDto } from './dto/rename-budget.dto';
import { BudgetsService } from './budgets.service';

const FINANCE_VISIBLE_ROLES = [
  Role.SYSTEM_ADMIN,
  Role.FINANCE_APPROVER,
  Role.DEPARTMENT_MANAGER,
  Role.TEAM_LEAD,
];

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@Controller('budgets')
@Roles(...FINANCE_VISIBLE_ROLES)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Put()
  @Roles(Role.SYSTEM_ADMIN)
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertBudgetDto) {
    return this.budgetsService.upsert(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.findAll(user.tenantId);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.getDashboard(user.tenantId);
  }

  // Just the category names, no amounts — safe for any authenticated user
  // (not just FINANCE_VISIBLE_ROLES) so the profile page can offer them as
  // Department options without leaking allocation/spend figures to everyone.
  @Get('department-names')
  @Roles()
  listDepartmentNames(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.listDepartmentNames(user.tenantId);
  }

  @Patch(':id')
  @Roles(Role.SYSTEM_ADMIN)
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RenameBudgetDto,
  ) {
    return this.budgetsService.rename(
      user.tenantId,
      id,
      user.userId,
      dto.departmentScope,
    );
  }

  @Delete(':id')
  @Roles(Role.SYSTEM_ADMIN)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.budgetsService.remove(user.tenantId, id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('department') department?: string,
  ) {
    return this.budgetsService.getTransactions(user.tenantId, department);
  }
}
