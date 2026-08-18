import { Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module';
import { FinanceDelegationsModule } from '../finance-delegations/finance-delegations.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [PoliciesModule, FinanceDelegationsModule, AuditLogsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
