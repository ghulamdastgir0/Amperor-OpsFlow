import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { OcrService } from './ocr.service';

// Split out from SlackModule so RequestsModule can also use OCR (for the
// finance-attaches-proof flow) without a circular import — SlackModule
// already imports RequestsModule.
@Module({
  imports: [LlmModule],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
