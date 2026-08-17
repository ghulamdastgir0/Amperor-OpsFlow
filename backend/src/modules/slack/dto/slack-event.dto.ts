export class SlackEventDto {
  token?: string;
  team_id?: string;
  event?: {
    type: string;
    channel?: string;
    user?: string;
    text?: string;
    files?: Array<{
      id: string;
      name: string;
      mimetype: string;
      url_private_download: string;
    }>;
  };
  // URL verification handshake (Slack Events API subscription setup)
  type?: 'url_verification' | 'event_callback';
  challenge?: string;
}
