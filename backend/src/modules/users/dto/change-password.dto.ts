import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  // Optional only because a Slack-only user (passwordHash null) is setting a
  // password for the first time and has none to confirm — UsersService still
  // requires it whenever a hash already exists.
  @IsString()
  @IsOptional()
  @MaxLength(200)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword: string;
}
