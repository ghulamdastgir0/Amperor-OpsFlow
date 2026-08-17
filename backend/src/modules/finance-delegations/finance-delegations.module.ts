import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FinanceDelegationsService } from './finance-delegations.service';
import { FinanceDelegationsController } from './finance-delegations.controller';

@Module({
  imports: [AuditLogsModule],
  controllers: [FinanceDelegationsController],
  providers: [FinanceDelegationsService],
  exports: [FinanceDelegationsService],
})
export class FinanceDelegationsModule {}
