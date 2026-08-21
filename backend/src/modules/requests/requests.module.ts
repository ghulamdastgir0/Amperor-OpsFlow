import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PoliciesModule } from '../policies/policies.module';
import { FinanceDelegationsModule } from '../finance-delegations/finance-delegations.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { OcrModule } from '../slack/ocr.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [
    PoliciesModule,
    FinanceDelegationsModule,
    AuditLogsModule,
    HttpModule,
    OcrModule,
    BudgetsModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
