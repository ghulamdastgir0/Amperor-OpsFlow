import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LlmService } from './llm.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [HttpModule],
  providers: [LlmService, EmbeddingService],
  exports: [LlmService, EmbeddingService],
})
export class LlmModule {}
