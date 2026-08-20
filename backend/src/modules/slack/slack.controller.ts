import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SlackEventDto } from './dto/slack-event.dto';
import { SlackService } from './slack.service';

@ApiTags('Slack')
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(private readonly slackService: SlackService) {}

  // Webhook Dispatch: Slack Events API -> file_shared / message events (SRS Section 5.1, step 2)
  // TODO: verify the X-Slack-Signature / X-Slack-Request-Timestamp headers against
  // SLACK_SIGNING_SECRET before trusting the payload (requires raw body capture).
  //
  // Uses @Res() to bypass the global TransformInterceptor: Slack's URL
  // verification handshake requires the raw `{"challenge": ...}` body at the
  // top level, not wrapped in this app's usual {success, data} envelope.
  @Public()
  @Post('events')
  handleEvent(@Body() payload: SlackEventDto, @Res() res: Response) {
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
}
