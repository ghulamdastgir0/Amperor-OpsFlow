import { IsOptional, IsString } from 'class-validator';

export class UpdateSlackConfigDto {
  @IsString()
  @IsOptional()
  slackTeamId?: string;

  // Channel where every message is treated as a query — no @mention required.
  @IsString()
  @IsOptional()
  slackQueryChannelId?: string;
}
