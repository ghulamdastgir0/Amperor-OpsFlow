import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { PoliciesModule } from '../policies/policies.module';
import { EmployeeRolesModule } from '../employee-roles/employee-roles.module';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [RequestsModule, PoliciesModule, EmployeeRolesModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
