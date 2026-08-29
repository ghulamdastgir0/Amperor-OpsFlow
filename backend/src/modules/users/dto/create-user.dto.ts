import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  department?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  slackUserId?: string;
}
