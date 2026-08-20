import { IsBoolean, IsOptional, IsString } from 'class-validator';

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

  // Restricted to FINANCE_APPROVER/SYSTEM_ADMIN — see PolicyDocument.restricted.
  @IsBoolean()
  @IsOptional()
  restricted?: boolean;
}
