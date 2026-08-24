import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestChannel, RequestStatus, Role, Tenant } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { AssistantService } from '../assistant/assistant.service';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import { OcrService } from './ocr.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  SlackEventDto,
  SlackEventPayloadDto,
  SlackFileDto,
} from './dto/slack-event.dto';
import { randomUUID } from 'crypto';

interface SlackAuthTestResponse {
  ok: boolean;
  user_id?: string;
}

interface SlackUsersInfoResponse {
  ok: boolean;
  user?: { profile?: { email?: string; real_name?: string } };
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
    private readonly storage: StorageService,
    private readonly users: UsersService,
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

    const requesterId = await this.resolveOrProvisionRequesterId(
      tenant,
      botToken,
      event,
    );
    if (!requesterId) {
      this.logger.warn(
        `Could not resolve or provision a user for Slack user ${event.user} in tenant ${tenant.id}`,
      );
      if (event.channel) {
        await this.postMessage(
          botToken,
          event.channel,
          "I couldn't verify your Slack profile to set up an OpsFlow account for you — ask an admin to add you manually.",
          event.thread_ts ?? event.ts,
        );
      }
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
        await this.ingestFile(botToken, tenant.id, request.id, file);
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
      await this.postMessage(
        botToken,
        event.channel,
        'On it — give me a moment.',
        threadTs,
      );
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
    tenantId: string,
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

    // Persist the actual bytes — previously only metadata was saved here,
    // leaving Slack-sourced attachments with nothing for the download route
    // to serve (Slack's own private-download URL requires the bot token and
    // isn't something the frontend can hit directly).
    const id = randomUUID();
    const storagePath = `attachments/${tenantId}/${requestId}/${id}-${file.name}`;
    await this.storage.upload(fileBuffer, storagePath, file.mimetype);

    // Step 5: attach parsed fields to the RequestIntent for policy matching
    return this.prisma.attachment.create({
      data: {
        id,
        requestId,
        source: 'slack',
        slackFileId: file.id,
        urlPrivateDownload: file.url_private_download,
        fileName: file.name,
        mimeType: file.mimetype,
        storagePath,
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

  // Being an authenticated member of a Slack workspace linked to a tenant is
  // already treated as proof of belonging to it — SlackOAuthService.
  // completeSlackLogin auto-provisions on that basis via "Continue with
  // Slack". This applies the same rule the first time someone messages the
  // bot directly, instead of requiring a separate trip through the portal
  // first. An existing password-based user with a matching email is linked
  // rather than duplicated, same as the login flow does.
  private async resolveOrProvisionRequesterId(
    tenant: Tenant,
    botToken: string,
    event: SlackEventPayloadDto,
  ): Promise<string | undefined> {
    const existing = await this.resolveRequesterId(tenant.id, event.user);
    if (existing) return existing;
    if (!event.user) return undefined;

    const profile = await this.fetchUserProfile(botToken, event.user);
    if (!profile?.email) {
      this.logger.warn(
        `Could not read Slack profile/email for user ${event.user} in tenant ${tenant.id} — can't auto-provision`,
      );
      return undefined;
    }

    const matchedByEmail = await this.users.findByEmail(
      tenant.id,
      profile.email,
    );
    if (matchedByEmail) {
      const linked = await this.users.linkSlackUserId(
        matchedByEmail.id,
        event.user,
      );
      return linked.id;
    }

    const created = await this.users.createSlackUser(tenant.id, {
      email: profile.email,
      name: profile.name ?? profile.email,
      slackUserId: event.user,
      role: Role.EMPLOYEE,
    });
    return created.id;
  }

  private async fetchUserProfile(
    botToken: string,
    slackUserId: string,
  ): Promise<{ email: string; name?: string } | undefined> {
    const response = await firstValueFrom(
      this.httpService.get<SlackUsersInfoResponse>(
        'https://slack.com/api/users.info',
        {
          params: { user: slackUserId },
          headers: { Authorization: `Bearer ${botToken}` },
        },
      ),
    );
    const user = response.data.user;
    if (!response.data.ok || !user?.profile?.email) return undefined;
    return { email: user.profile.email, name: user.profile.real_name };
  }
}
