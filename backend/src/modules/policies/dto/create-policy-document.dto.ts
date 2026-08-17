import { IsOptional, IsString } from 'class-validator';

export class CreatePolicyDocumentDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  version?: string;
}
