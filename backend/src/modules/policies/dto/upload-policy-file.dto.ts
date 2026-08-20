import { IsOptional, IsString } from 'class-validator';

export class UploadPolicyFileDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  version?: string;
}
