import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SLACK_TEAM_ID_PATTERN } from './create-tenant.dto';

export class UpdateSlackConfigDto {
  @IsString()
  @IsOptional()
  @Matches(SLACK_TEAM_ID_PATTERN, {
    message: 'Slack team ID must look like T01ABCDE2F',
  })
  slackTeamId?: string;

  // Channel where every message is treated as a query — no @mention required.
  @IsString()
  @IsOptional()
  @MaxLength(40)
  slackQueryChannelId?: string;
}
