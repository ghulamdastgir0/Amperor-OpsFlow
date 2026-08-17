import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';

const DETAIL_INCLUDE = {
  attachments: true,
  executionSteps: { orderBy: { sequenceOrder: 'asc' as const } },
  policyCitations: { include: { policyDocument: true } },
  approvals: true,
};

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, requesterId: string, dto: CreateRequestDto) {
    const request = await this.prisma.request.create({
      data: {
        tenantId,
        requesterId,
        channel: dto.channel,
        rawPrompt: dto.rawPrompt,
        parsedIntent: dto.parsedIntent ?? 'UNCLASSIFIED',
        status: RequestStatus.PENDING_POLICY_CHECK,
      },
    });

    // Seed the Live Execution Timeline (FR-UI-002)
    await this.prisma.executionStep.create({
      data: {
        requestId: request.id,
        stepName: 'Checking Policy...',
        sequenceOrder: 1,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    return request;
  }

  findAll(tenantId: string) {
    return this.prisma.request.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const request = await this.prisma.request.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async updateStatus(tenantId: string, id: string, status: RequestStatus) {
    await this.findOne(tenantId, id);
    return this.prisma.request.update({ where: { id }, data: { status } });
  }
}
