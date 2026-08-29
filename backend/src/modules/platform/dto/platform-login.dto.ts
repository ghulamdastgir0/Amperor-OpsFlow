import { IsEmail, IsString, MaxLength } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;
}
