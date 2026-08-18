import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { PoliciesModule } from '../policies/policies.module';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [RequestsModule, PoliciesModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
