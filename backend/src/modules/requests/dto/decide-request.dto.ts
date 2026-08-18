import { ApprovalDecision } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class DecideRequestDto {
  @IsIn([ApprovalDecision.APPROVED, ApprovalDecision.REJECTED])
  decision: typeof ApprovalDecision.APPROVED | typeof ApprovalDecision.REJECTED;

  @IsString()
  @IsOptional()
  reason?: string;
}
