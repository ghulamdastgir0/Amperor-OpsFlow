import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlatformAdminDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsBoolean()
  @IsOptional()
  isGlobalAdmin?: boolean;
}
