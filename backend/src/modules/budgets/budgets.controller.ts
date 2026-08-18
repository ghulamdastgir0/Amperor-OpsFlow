import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
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

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('department') department?: string,
  ) {
    return this.budgetsService.getTransactions(user.tenantId, department);
  }
}
