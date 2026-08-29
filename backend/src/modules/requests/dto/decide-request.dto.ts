import { ApprovalDecision } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideRequestDto {
  @IsIn([ApprovalDecision.APPROVED, ApprovalDecision.REJECTED])
  decision: typeof ApprovalDecision.APPROVED | typeof ApprovalDecision.REJECTED;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}
