import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { PoliciesModule } from '../policies/policies.module';
import { EmployeeRolesModule } from '../employee-roles/employee-roles.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { UsersModule } from '../users/users.module';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [
    RequestsModule,
    PoliciesModule,
    EmployeeRolesModule,
    BudgetsModule,
    UsersModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
