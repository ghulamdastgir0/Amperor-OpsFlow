import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SlackEventDto } from './dto/slack-event.dto';
import { SlackService } from './slack.service';

@ApiTags('Slack')
@Controller('slack')
export class SlackController {
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
  async handleEvent(@Body() payload: SlackEventDto, @Res() res: Response) {
    // Bypassing Nest's response handling via @Res() means it no longer
    // applies its default 201-for-POST status — set 200 explicitly, since
    // Slack's URL verification handshake requires exactly that.
    if (payload.type === 'url_verification') {
      res.status(200).json({ challenge: payload.challenge });
      return;
    }

    await this.slackService.handleEvent(payload);
    res.status(200).json({ ok: true });
  }
}
