import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { FinanceDelegationsModule } from './modules/finance-delegations/finance-delegations.module';
import { RequestsModule } from './modules/requests/requests.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { SlackModule } from './modules/slack/slack.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { LlmModule } from './modules/llm/llm.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { PlatformAdminModule } from './modules/platform/platform-admin.module';
import { EmployeeRolesModule } from './modules/employee-roles/employee-roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Baseline abuse protection — a generous per-IP ceiling for ordinary API
    // traffic. Sensitive endpoints (login, the assistant, the Slack webhook)
    // set their own tighter @Throttle() on top of this.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    FinanceDelegationsModule,
    RequestsModule,
    AssistantModule,
    SlackModule,
    PoliciesModule,
    AuditLogsModule,
    LlmModule,
    BudgetsModule,
    PlatformAdminModule,
    EmployeeRolesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ThrottlerGuard first so a flood is rejected before any auth/DB work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
