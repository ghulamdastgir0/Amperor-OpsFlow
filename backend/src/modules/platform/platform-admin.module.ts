import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RequestsModule } from '../requests/requests.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';

@Module({
  imports: [UsersModule, RequestsModule, BudgetsModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
