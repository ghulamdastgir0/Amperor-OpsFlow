import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PoliciesModule } from '../policies/policies.module';
import { EmployeeRolesService } from './employee-roles.service';
import { EmployeeRolesController } from './employee-roles.controller';

@Module({
  imports: [HttpModule, PoliciesModule],
  controllers: [EmployeeRolesController],
  providers: [EmployeeRolesService],
  exports: [EmployeeRolesService],
})
export class EmployeeRolesModule {}
