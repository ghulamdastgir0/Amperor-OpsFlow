import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestChannel, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { AssistantService } from '../assistant/assistant.service';
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
  private botUserId: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly ocr: OcrService,
    private readonly assistant: AssistantService,
  ) {}

  // Ingestion Pipeline Sequence (SRS Section 5.1) + query routing:
  // an incoming message is treated as an actionable query when the bot is
  // @-mentioned (anywhere), it's a DM to the bot, or it's posted in the
  // tenant's dedicated query channel.
  async handleEvent(payload: SlackEventDto) {
    const event = payload.event;
    if (!event || !payload.team_id) return;

    // Ignore messages posted by any bot, including ourselves, to avoid reply loops.
    if (event.bot_id) return;

    const tenant = await this.tenants.findBySlackTeamId(payload.team_id);
    if (!tenant) {
      this.logger.warn(`No tenant mapped for Slack team ${payload.team_id}`);
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

    const text = await this.stripBotMention(event.text ?? '');
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
        await this.ingestFile(request.id, file);
      }

      if (event.channel) {
        await this.postMessage(
          event.channel,
          `Got it — I'm processing your request (ref \`${request.id}\`).`,
          threadTs,
        );
      }

      return request;
    }

    // No attachment: route the message through the same conversational
    // pipeline the Assistant UI uses.
    const result = await this.assistant.sendMessage(tenant.id, requesterId, {
      content: text,
    });
    const reply = result.messages[result.messages.length - 1];
    if (event.channel && reply) {
      await this.postMessage(event.channel, reply.content, threadTs);
    }
    return result;
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

  private async stripBotMention(text: string): Promise<string> {
    const botUserId = await this.getBotUserId();
    if (!botUserId) return text.trim();
    return text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();
  }

  private async getBotUserId(): Promise<string | undefined> {
    if (this.botUserId) return this.botUserId;
    const botToken = this.config.get<string>('slack.botToken');
    if (!botToken) return undefined;

    const response = await firstValueFrom(
      this.httpService.post<SlackAuthTestResponse>(
        'https://slack.com/api/auth.test',
        {},
        { headers: { Authorization: `Bearer ${botToken}` } },
      ),
    );
    this.botUserId = response.data.user_id;
    return this.botUserId;
  }

  private async postMessage(channel: string, text: string, threadTs?: string) {
    const botToken = this.config.get<string>('slack.botToken');
    await firstValueFrom(
      this.httpService.post(
        'https://slack.com/api/chat.postMessage',
        { channel, text, thread_ts: threadTs },
        { headers: { Authorization: `Bearer ${botToken}` } },
      ),
    );
  }

  // Step 3: Secure Download via bot token
  private async ingestFile(requestId: string, file: SlackFileDto) {
    const botToken = this.config.get<string>('slack.botToken');
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
