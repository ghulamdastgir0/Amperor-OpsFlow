import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TenantsModule } from '../tenants/tenants.module';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [HttpModule, TenantsModule],
  controllers: [SlackController],
  providers: [SlackService, OcrService],
})
export class SlackModule {}
