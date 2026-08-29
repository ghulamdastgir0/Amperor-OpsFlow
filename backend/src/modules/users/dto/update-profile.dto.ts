import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
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
  @IsOptional()
  @MaxLength(120)
  department?: string;
}
