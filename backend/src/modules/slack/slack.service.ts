import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RequestChannel, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { OcrService } from './ocr.service';
import { SlackEventDto } from './dto/slack-event.dto';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly ocr: OcrService,
  ) {}

  // Ingestion Pipeline Sequence (SRS Section 5.1)
  async handleEvent(payload: SlackEventDto) {
    const event = payload.event;
    if (
      !event ||
      event.type !== 'message' ||
      !event.files?.length ||
      !payload.team_id
    ) {
      return;
    }

    const tenant = await this.tenants.findBySlackTeamId(payload.team_id);
    if (!tenant) {
      this.logger.warn(`No tenant mapped for Slack team ${payload.team_id}`);
      return;
    }

    const requesterId = await this.resolveRequesterId(tenant.id, event.user);
    if (!requesterId) {
      this.logger.warn(
        `Slack user ${event.user} is not linked to a user in tenant ${tenant.id}`,
      );
      return;
    }

    const request = await this.prisma.request.create({
      data: {
        tenantId: tenant.id,
        requesterId,
        channel: RequestChannel.slack,
        rawPrompt: event.text ?? '',
        parsedIntent: 'EXPENSE_REIMBURSEMENT',
        status: RequestStatus.PENDING_POLICY_CHECK,
      },
    });

    for (const file of event.files) {
      await this.ingestFile(tenant.id, request.id, file);
    }

    return request;
  }

  // Step 3: Secure Download via bot token
  private async ingestFile(
    tenantId: string,
    requestId: string,
    file: {
      id: string;
      name: string;
      mimetype: string;
      url_private_download: string;
    },
  ) {
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
