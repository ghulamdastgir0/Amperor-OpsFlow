export class SlackFileDto {
  id: string;
  name: string;
  mimetype: string;
  url_private_download: string;
}

export class SlackEventPayloadDto {
  // 'message' (channel/DM post), 'app_mention' (bot @-tagged anywhere)
  type: string;
  channel?: string;
  // 'im' for a direct message to the bot, 'channel'/'group' otherwise
  channel_type?: string;
  user?: string;
  text?: string;
  files?: SlackFileDto[];
  ts?: string;
  thread_ts?: string;
  // Present when the message was posted by a bot (including our own) — used to prevent loops.
  bot_id?: string;
}

export class SlackEventDto {
  token?: string;
  team_id?: string;
  event?: SlackEventPayloadDto;
  // URL verification handshake (Slack Events API subscription setup)
  type?: 'url_verification' | 'event_callback';
  challenge?: string;
}
