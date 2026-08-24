import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TenantsModule } from '../tenants/tenants.module';
import { AssistantModule } from '../assistant/assistant.module';
import { RequestsModule } from '../requests/requests.module';
import { LlmModule } from '../llm/llm.module';
import { UsersModule } from '../users/users.module';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { OcrModule } from './ocr.module';

@Module({
  imports: [
    HttpModule,
    TenantsModule,
    AssistantModule,
    RequestsModule,
    LlmModule,
    OcrModule,
    UsersModule,
  ],
  controllers: [SlackController],
  providers: [SlackService],
})
export class SlackModule {}
