import { IsEmail, IsString } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
