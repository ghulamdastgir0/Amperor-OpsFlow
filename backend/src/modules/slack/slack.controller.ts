import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SlackEventDto } from './dto/slack-event.dto';
import { SlackService } from './slack.service';

@Controller('slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  // Webhook Dispatch: Slack Events API -> file_shared / message events (SRS Section 5.1, step 2)
  // TODO: verify the X-Slack-Signature / X-Slack-Request-Timestamp headers against
  // SLACK_SIGNING_SECRET before trusting the payload (requires raw body capture).
  @Public()
  @Post('events')
  @HttpCode(200)
  async handleEvent(@Body() payload: SlackEventDto) {
    // Events API URL verification handshake
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    await this.slackService.handleEvent(payload);
    return { ok: true };
  }
}
