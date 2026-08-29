import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePolicyDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1_000_000)
  content: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  version?: string;

  // Restricted to FINANCE_APPROVER/SYSTEM_ADMIN — see PolicyDocument.restricted.
  @IsBoolean()
  @IsOptional()
  restricted?: boolean;
}
