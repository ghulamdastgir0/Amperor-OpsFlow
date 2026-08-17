import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePolicyDocumentDto } from './dto/create-policy-document.dto';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreatePolicyDocumentDto) {
    return this.prisma.policyDocument.create({ data: { tenantId, ...dto } });
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

  // Policy Matching step of the ingestion/orchestration pipeline (SRS Section 5.1, step 5).
  // Wire this up to the RAG engine's retrieval index.
  findRelevantClauses(tenantId: string, query: string) {
    void tenantId;
    void query;
    return Promise.resolve(
      [] as Array<{
        policyDocumentId: string;
        clauseSnippet: string;
        relevanceScore: number;
      }>,
    );
  }
}
