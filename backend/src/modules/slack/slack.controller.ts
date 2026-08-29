import {
  Body,
  Controller,
  ForbiddenException,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SlackEventDto } from './dto/slack-event.dto';
import { SlackService } from './slack.service';

// Slack rejects (and retries) anything older than this; we reject it too so a
// captured request body can't be replayed later.
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

@ApiTags('Slack')
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly config: ConfigService,
  ) {}

  // Webhook Dispatch: Slack Events API -> file_shared / message events (SRS Section 5.1, step 2)
  //
  // Uses @Res() to bypass the global TransformInterceptor: Slack's URL
  // verification handshake requires the raw `{"challenge": ...}` body at the
  // top level, not wrapped in this app's usual {success, data} envelope.
  @Public()
  // Generous — real Slack traffic (plus its retries) stays well under this,
  // but a flood of forged/unsigned posts is capped.
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @Post('events')
  handleEvent(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: SlackEventDto,
    @Res() res: Response,
  ) {
    this.assertValidSlackSignature(req);

    // Bypassing Nest's response handling via @Res() means it no longer
    // applies its default 201-for-POST status — set 200 explicitly, since
    // Slack's URL verification handshake requires exactly that.
    if (payload.type === 'url_verification') {
      res.status(200).json({ challenge: payload.challenge });
      return;
    }

    // Ack immediately, before processing. Slack requires a 200 within 3s or
    // it retries delivery of the same event — and handleEvent's assistant
    // path can take far longer than that (a Gemini call alone can run
    // 8-100+s), so previously awaiting it here meant Slack's own retry
    // reprocessed the same message and produced a duplicate reply. Real bug,
    // reproduced 2026-08-20 (two conversations created ~3s apart for one
    // Slack message). SlackService.handleEvent also dedupes by event_id as a
    // second layer, since Slack can resend for other reasons too.
    res.status(200).json({ ok: true });
    this.slackService.handleEvent(payload).catch((error: unknown) => {
      this.logger.error(
        `Slack event handling failed: ${(error as Error).message}`,
      );
    });
  }

  // Verifies X-Slack-Signature over `v0:<timestamp>:<raw body>` with
  // SLACK_SIGNING_SECRET (https://api.slack.com/authentication/verifying-requests-from-slack).
  // When no signing secret is configured the endpoint is left open but the
  // gap is logged loudly — a deployment that wants Slack MUST set the secret.
  private assertValidSlackSignature(req: RawBodyRequest<Request>) {
    const signingSecret = this.config.get<string>('slack.signingSecret');
    if (!signingSecret) {
      this.logger.warn(
        'SLACK_SIGNING_SECRET is not set — /slack/events is accepting unsigned requests. Set it to enforce Slack request verification.',
      );
      return;
    }

    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const rawBody = req.rawBody?.toString('utf8');
    if (
      typeof signature !== 'string' ||
      typeof timestamp !== 'string' ||
      rawBody === undefined
    ) {
      throw new ForbiddenException('Missing Slack signature headers');
    }

    const ts = Number(timestamp);
    if (
      !Number.isFinite(ts) ||
      Math.abs(Date.now() / 1000 - ts) > MAX_TIMESTAMP_SKEW_SECONDS
    ) {
      throw new ForbiddenException('Stale Slack request timestamp');
    }

    const expected =
      'v0=' +
      createHmac('sha256', signingSecret)
        .update(`v0:${timestamp}:${rawBody}`)
        .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid Slack signature');
    }
  }
}
