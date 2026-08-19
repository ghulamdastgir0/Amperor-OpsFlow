import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SlackFileDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  mimetype: string;

  @IsString()
  url_private_download: string;
}

export class SlackEventPayloadDto {
  // 'message' (channel/DM post), 'app_mention' (bot @-tagged anywhere)
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  channel?: string;

  // 'im' for a direct message to the bot, 'channel'/'group' otherwise
  @IsOptional()
  @IsString()
  channel_type?: string;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlackFileDto)
  files?: SlackFileDto[];

  @IsOptional()
  @IsString()
  ts?: string;

  @IsOptional()
  @IsString()
  thread_ts?: string;

  // Present when the message was posted by a bot (including our own) — used to prevent loops.
  @IsOptional()
  @IsString()
  bot_id?: string;
}

export class SlackEventDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  team_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SlackEventPayloadDto)
  event?: SlackEventPayloadDto;

  // URL verification handshake (Slack Events API subscription setup)
  @IsOptional()
  @IsIn(['url_verification', 'event_callback'])
  type?: 'url_verification' | 'event_callback';

  @IsOptional()
  @IsString()
  challenge?: string;
}
