import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UploadPolicyFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  version?: string;

  // Multipart fields arrive as strings ("true"/"false"), not real booleans.
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  restricted?: boolean;
}
