import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Slack workspace IDs always look like T01ABCDE2F — a 'T' followed by 8-10
// upper-case alphanumerics. This can't be checked against Slack itself here:
// Slack has no public endpoint that confirms a team ID exists without a bot
// token for that workspace, which only exists once "Add to Slack" OAuth has
// completed. So this is shape validation only — real verification happens
// when OAuth install runs and overwrites this with the authenticated ID.
export const SLACK_TEAM_ID_PATTERN = /^T[A-Z0-9]{8,10}$/;

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @Matches(SLACK_TEAM_ID_PATTERN, {
    message: 'Slack team ID must look like T01ABCDE2F',
  })
  slackTeamId?: string;
}
