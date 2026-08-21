import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestChannel, RequestStatus, Tenant } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { AssistantService } from '../assistant/assistant.service';
import { RequestsService } from '../requests/requests.service';
import { OcrService } from './ocr.service';
import {
  SlackEventDto,
  SlackEventPayloadDto,
  SlackFileDto,
} from './dto/slack-event.dto';

interface SlackAuthTestResponse {
  ok: boolean;
  user_id?: string;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  // Fallback for the bot user id when a tenant hasn't stored one via OAuth install.
  private fallbackBotUserId: string | undefined;
  // Bounded in-memory dedup for Slack's event_id — Slack resends the same
  // event_callback on delivery retry (e.g. slow ack), which previously
  // produced duplicate replies/requests. Insertion-order Set used as a
  // simple bounded cache; process-local is fine here, same pragmatism as
  // PoliciesService's non-vector-DB retrieval.
  private readonly recentEventIds = new Set<string>();
  private static readonly MAX_RECENT_EVENT_IDS = 500;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly ocr: OcrService,
    private readonly assistant: AssistantService,
    private readonly requests: RequestsService,
  ) {}

  // Ingestion Pipeline Sequence (SRS Section 5.1) + query routing:
  // an incoming message is treated as an actionable query when the bot is
  // @-mentioned (anywhere), it's a DM to the bot, or it's posted in the
  // tenant's dedicated query channel.
  async handleEvent(payload: SlackEventDto) {
    const event = payload.event;
    if (!event || !payload.team_id) return;

    if (payload.event_id) {
      if (this.recentEventIds.has(payload.event_id)) {
        this.logger.log(`Ignoring duplicate Slack event ${payload.event_id}`);
        return;
      }
      this.recentEventIds.add(payload.event_id);
      if (this.recentEventIds.size > SlackService.MAX_RECENT_EVENT_IDS) {
        const oldest = this.recentEventIds.values().next().value;
        if (oldest) this.recentEventIds.delete(oldest);
      }
    }

    // Ignore messages posted by any bot, including ourselves, to avoid reply loops.
    if (event.bot_id) return;

    const tenant = await this.tenants.findBySlackTeamId(payload.team_id);
    if (!tenant) {
      this.logger.warn(`No tenant mapped for Slack team ${payload.team_id}`);
      return;
    }

    const botToken = this.resolveBotToken(tenant);
    if (!botToken) {
      this.logger.warn(`No bot token available for tenant ${tenant.id}`);
      return;
    }

    if (!this.shouldProcessEvent(event, tenant.slackQueryChannelId)) return;

    const requesterId = await this.resolveRequesterId(tenant.id, event.user);
    if (!requesterId) {
      this.logger.warn(
        `Slack user ${event.user} is not linked to a user in tenant ${tenant.id}`,
      );
      return;
    }

    const text = await this.stripBotMention(event.text ?? '', tenant, botToken);
    const threadTs = event.thread_ts ?? event.ts;

    if (event.files?.length) {
      const request = await this.prisma.request.create({
        data: {
          tenantId: tenant.id,
          requesterId,
          channel: RequestChannel.slack,
          rawPrompt: text,
          parsedIntent: 'EXPENSE_REIMBURSEMENT',
          status: RequestStatus.PENDING_POLICY_CHECK,
        },
      });

      for (const file of event.files) {
        await this.ingestFile(botToken, request.id, file);
      }

      if (event.channel) {
        await this.postMessage(
          botToken,
          event.channel,
          `Got it — I'm processing your request.`,
          threadTs,
        );
      }

      const routed = await this.requests.runPipeline(tenant.id, request.id);

      if (event.channel) {
        await this.postMessage(
          botToken,
          event.channel,
          this.describeRoutedStatus(routed.status),
          threadTs,
        );
      }

      return routed;
    }

    // No attachment: route the message through the same conversational
    // pipeline the Assistant UI uses. Ack immediately, same as the
    // attachment branch above — a Gemini call here can take 8-100+s, and
    // with no interim message Slack shows nothing at all until it's done,
    // which reads as broken/stuck rather than just slow.
    if (event.channel) {
      await this.postMessage(botToken, event.channel, 'On it — give me a moment.', threadTs);
    }
    const result = await this.assistant.sendMessage(
      tenant.id,
      requesterId,
      { content: text },
      RequestChannel.slack,
    );
    const reply = result.messages[result.messages.length - 1];
    if (event.channel && reply) {
      await this.postMessage(botToken, event.channel, reply.content, threadTs);
    }
    return result;
  }

  private describeRoutedStatus(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.COMPLETED:
        return 'No approval needed — this one is already marked complete.';
      case RequestStatus.PENDING_MANAGER_APPROVAL:
        return 'Routed to a manager for approval.';
      case RequestStatus.ESCALATED:
        return 'Escalated to an admin — no finance delegate currently covers this amount.';
      default:
        return `Status: ${status}.`;
    }
  }

  private resolveBotToken(tenant: Tenant): string | undefined {
    return tenant.slackBotToken ?? this.config.get<string>('slack.botToken');
  }

  private shouldProcessEvent(
    event: SlackEventPayloadDto,
    dedicatedQueryChannelId: string | null,
  ): boolean {
    if (event.type === 'app_mention') return true;
    if (event.type !== 'message') return false;
    if (event.channel_type === 'im') return true;
    if (dedicatedQueryChannelId && event.channel === dedicatedQueryChannelId)
      return true;
    return false;
  }

  private async stripBotMention(
    text: string,
    tenant: Tenant,
    botToken: string,
  ): Promise<string> {
    const botUserId =
      tenant.slackBotUserId ?? (await this.getFallbackBotUserId(botToken));
    if (!botUserId) return text.trim();
    return text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();
  }

  // Only used for the global fallback token (tenants installed via OAuth
  // already have their bot_user_id stored on Tenant.slackBotUserId).
  private async getFallbackBotUserId(
    botToken: string,
  ): Promise<string | undefined> {
    if (this.fallbackBotUserId) return this.fallbackBotUserId;

    const response = await firstValueFrom(
      this.httpService.post<SlackAuthTestResponse>(
        'https://slack.com/api/auth.test',
        {},
        { headers: { Authorization: `Bearer ${botToken}` } },
      ),
    );
    this.fallbackBotUserId = response.data.user_id;
    return this.fallbackBotUserId;
  }

  private async postMessage(
    botToken: string,
    channel: string,
    text: string,
    threadTs?: string,
  ) {
    await firstValueFrom(
      this.httpService.post(
        'https://slack.com/api/chat.postMessage',
        { channel, text, thread_ts: threadTs },
        { headers: { Authorization: `Bearer ${botToken}` } },
      ),
    );
  }

  // Step 3: Secure Download via bot token
  private async ingestFile(
    botToken: string,
    requestId: string,
    file: SlackFileDto,
  ) {
    const response = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(file.url_private_download, {
        headers: { Authorization: `Bearer ${botToken}` },
        responseType: 'arraybuffer',
      }),
    );
    const fileBuffer = Buffer.from(response.data);

    // Step 4: Multimodal & OCR Parsing
    const parsed = await this.ocr.extractFields(fileBuffer, file.mimetype);

    // Step 5: attach parsed fields to the RequestIntent for policy matching
    return this.prisma.attachment.create({
      data: {
        requestId,
        source: 'slack',
        slackFileId: file.id,
        urlPrivateDownload: file.url_private_download,
        fileName: file.name,
        mimeType: file.mimetype,
        merchantName: parsed.merchantName,
        totalAmount: parsed.totalAmount,
        currency: parsed.currency,
        lineItems: parsed.lineItems,
        taxId: parsed.taxId,
        documentDate: parsed.documentDate
          ? new Date(parsed.documentDate)
          : undefined,
        ocrRawText: parsed.rawText,
      },
    });
  }

  private async resolveRequesterId(tenantId: string, slackUserId?: string) {
    if (!slackUserId) return undefined;
    const user = await this.prisma.user.findFirst({
      where: { tenantId, slackUserId },
    });
    return user?.id;
  }
}
