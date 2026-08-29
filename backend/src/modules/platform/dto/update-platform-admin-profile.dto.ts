import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePlatformAdminProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(320)
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @IsOptional()
  password?: string;
}
