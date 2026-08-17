import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  // Conversational Command Canvas: multi-turn dialogue with state tracking (FR-UI-001)
  async sendMessage(tenantId: string, userId: string, dto: SendMessageDto) {
    const conversation = dto.conversationId
      ? await this.getConversation(tenantId, dto.conversationId)
      : await this.prisma.conversation.create({ data: { tenantId, userId } });

    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: dto.content,
      },
    });

    // TODO: route dto.content through the orchestration/RAG engine to produce
    // a RequestIntent, execution steps, and policy citations, then persist the
    // assistant's reply here.
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: 'Acknowledged — orchestration engine not yet wired up.',
      },
    });

    return { conversation, messages: [userMessage, assistantMessage] };
  }

  async listConversations(tenantId: string, userId: string) {
    return this.prisma.conversation.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(tenantId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getMessages(tenantId: string, conversationId: string) {
    await this.getConversation(tenantId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Live Execution Timeline (FR-UI-002)
  async getExecutionTimeline(tenantId: string, requestId: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return this.prisma.executionStep.findMany({
      where: { requestId },
      orderBy: { sequenceOrder: 'asc' },
    });
  }

  // Context & Citation Viewer (FR-UI-003)
  async getPolicyCitations(tenantId: string, requestId: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return this.prisma.policyCitation.findMany({
      where: { requestId },
      include: { policyDocument: true },
    });
  }
}
