import { Injectable, Logger } from '@nestjs/common';

// Local, in-process embeddings via transformers.js — no API key, no network
// call, no rate limits. Model weights (~90MB) download once on first use and
// are cached under the transformers.js default cache dir.
export const EMBEDDING_DIMENSIONS = 384;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array }>;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractorPromise) {
      this.logger.log(`Loading local embedding model ${MODEL_ID} (first call only)...`);
      this.extractorPromise = import('@xenova/transformers').then(({ pipeline }) =>
        pipeline('feature-extraction', MODEL_ID) as unknown as Promise<FeatureExtractionPipeline>,
      );
    }
    return this.extractorPromise;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}
