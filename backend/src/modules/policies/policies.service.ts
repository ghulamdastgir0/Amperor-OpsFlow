import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { CreatePolicyDocumentDto } from './dto/create-policy-document.dto';

const CHUNK_SIZE = 1500;
const RELEVANCE_FLOOR = 0.5;
const TOP_K = 3;

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async create(tenantId: string, dto: CreatePolicyDocumentDto) {
    const document = await this.prisma.policyDocument.create({
      data: { tenantId, ...dto },
    });

    try {
      const chunks = this.chunkContent(dto.content);
      for (const content of chunks) {
        const embedding = await this.llm.embedContent(content);
        await this.prisma.policyChunk.create({
          data: { policyDocumentId: document.id, tenantId, content, embedding },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to embed policy document ${document.id}: ${(error as Error).message}`,
      );
    }

    return document;
  }

  findAll(tenantId: string) {
    return this.prisma.policyDocument.findMany({
      where: { tenantId },
      orderBy: { title: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const document = await this.prisma.policyDocument.findFirst({
      where: { id, tenantId },
    });
    if (!document) throw new NotFoundException('Policy document not found');
    return document;
  }

  // Policy Matching step of the ingestion/orchestration pipeline (SRS Section 5.1, step 5):
  // embed the query and rank the tenant's policy chunks by cosine similarity.
  async findRelevantClauses(
    tenantId: string,
    query: string,
  ): Promise<
    Array<{
      policyDocumentId: string;
      clauseSnippet: string;
      relevanceScore: number;
    }>
  > {
    try {
      const chunks = await this.prisma.policyChunk.findMany({
        where: { tenantId },
      });
      if (chunks.length === 0) return [];

      const queryEmbedding = await this.llm.embedContent(query);

      return chunks
        .map((chunk) => ({
          policyDocumentId: chunk.policyDocumentId,
          clauseSnippet: chunk.content,
          relevanceScore: this.cosineSimilarity(
            queryEmbedding,
            chunk.embedding as number[],
          ),
        }))
        .filter((result) => result.relevanceScore >= RELEVANCE_FLOOR)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, TOP_K);
    } catch (error) {
      this.logger.warn(
        `Policy retrieval failed for tenant ${tenantId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private chunkContent(content: string): string[] {
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let current = '';
    for (const paragraph of paragraphs) {
      if (current && current.length + paragraph.length + 2 > CHUNK_SIZE) {
        chunks.push(current);
        current = paragraph;
      } else {
        current = current ? `${current}\n\n${paragraph}` : paragraph;
      }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [content.trim()].filter(Boolean);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
