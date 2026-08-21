import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../llm/embedding.service';
import { StorageService } from '../../common/storage/storage.service';
import { CreatePolicyDocumentDto } from './dto/create-policy-document.dto';
import { randomUUID } from 'crypto';

// A PolicyDocument.restricted document (financial/budget detail, etc.) is
// only ever surfaced in retrieval results for these roles — everyone else
// (including a plain EMPLOYEE) gets the same "nothing found" result they'd
// get if the document didn't exist, both via search_policy and via the
// citation viewer on their own filed request.
export const RESTRICTED_DOC_VISIBLE_ROLES = new Set<Role>([
  Role.FINANCE_APPROVER,
  Role.SYSTEM_ADMIN,
]);

const CHUNK_SIZE = 1500;
// Tuned for the local MiniLM embedding model, not Gemini's — MiniLM's cosine
// similarity for genuinely relevant short-query/long-chunk pairs typically
// lands around 0.4-0.6, notably lower than Gemini's embedding space. The old
// 0.5 floor (calibrated for Gemini) silently filtered out valid matches after
// the switch — verified against real policy content before changing this.
const RELEVANCE_FLOOR = 0.35;
const TOP_K = 3;

const PDF_MIME_TYPES = new Set(['application/pdf']);
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown']);

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
    private readonly storage: StorageService,
  ) {}

  async create(
    tenantId: string,
    dto: CreatePolicyDocumentDto,
    extra?: { id: string; storagePath: string },
  ) {
    const document = await this.prisma.policyDocument.create({
      data: { tenantId, ...dto, ...extra },
    });

    try {
      const chunks = this.chunkContent(dto.content);
      for (const content of chunks) {
        const embedding = await this.embeddings.embed(content);
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

  // Extracts text server-side so the frontend never needs a manual paste
  // step when a file is provided — PDFs in particular can't be read as
  // plain text client-side (file.text() on a PDF just yields binary noise).
  async createFromFile(
    tenantId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    meta: { title: string; sourceUrl?: string; version?: string; restricted?: boolean },
  ) {
    const content = await this.extractText(file);
    if (!content.trim()) {
      throw new BadRequestException(
        'No readable text could be extracted from this file.',
      );
    }
    // Archive the original file too — `content` above is only the extracted
    // text used for RAG search; the source PDF/txt/md itself is otherwise
    // discarded once extraction succeeds.
    const id = randomUUID();
    const storagePath = `policies/${tenantId}/${id}-${file.originalname}`;
    await this.storage.upload(file.buffer, storagePath, file.mimetype);
    return this.create(tenantId, { ...meta, content }, { id, storagePath });
  }

  async getFile(tenantId: string, id: string) {
    const document = await this.prisma.policyDocument.findFirst({
      where: { id, tenantId },
      select: { storagePath: true, title: true },
    });
    if (!document?.storagePath) {
      throw new NotFoundException('No source file stored for this document');
    }
    return document;
  }

  private async extractText(file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  }): Promise<string> {
    if (PDF_MIME_TYPES.has(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf')) {
      const parser = new PDFParse({ data: file.buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text;
      } catch (error) {
        throw new BadRequestException(
          `Could not read this PDF: ${(error as Error).message}`,
        );
      } finally {
        await parser.destroy();
      }
    }
    if (
      TEXT_MIME_TYPES.has(file.mimetype) ||
      /\.(txt|md)$/i.test(file.originalname)
    ) {
      return file.buffer.toString('utf-8');
    }
    throw new BadRequestException(
      'Unsupported file type — upload a PDF, .txt, or .md file.',
    );
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
  // actingRole gates out chunks belonging to a `restricted` PolicyDocument
  // for anyone who isn't FINANCE_APPROVER/SYSTEM_ADMIN — required on every
  // call site (search_policy tool, request policy-citation step, role
  // description suggestion) so restricted content can't leak through any of
  // them to an unauthorized user.
  async findRelevantClauses(
    tenantId: string,
    query: string,
    actingRole: Role,
  ): Promise<
    Array<{
      policyDocumentId: string;
      clauseSnippet: string;
      relevanceScore: number;
    }>
  > {
    try {
      const canSeeRestricted = RESTRICTED_DOC_VISIBLE_ROLES.has(actingRole);
      const chunks = await this.prisma.policyChunk.findMany({
        where: {
          tenantId,
          ...(canSeeRestricted ? {} : { policyDocument: { restricted: false } }),
        },
      });
      if (chunks.length === 0) return [];

      const queryEmbedding = await this.embeddings.embed(query);

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
