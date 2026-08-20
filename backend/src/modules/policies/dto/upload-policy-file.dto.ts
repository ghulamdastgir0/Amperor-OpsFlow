import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UploadPolicyFileDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  version?: string;

  // Multipart fields arrive as strings ("true"/"false"), not real booleans.
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  restricted?: boolean;
}
