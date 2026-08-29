import { RequestChannel } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

// Request.statedAmount / Attachment.totalAmount are Decimal(12,2) — max 10
// integer digits. Cap well under that so an out-of-range figure is a clean
// 400, not an unhandled Prisma/Postgres numeric-overflow 500.
const MAX_MONEY = 9_999_999_999;

export class CreateRequestDto {
  @IsEnum(RequestChannel)
  channel: RequestChannel;

  @IsString()
  @MaxLength(8000)
  rawPrompt: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  parsedIntent?: string;

  // LLM-extracted, unverified amount mentioned in chat — see Request.statedAmount.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_MONEY)
  @IsOptional()
  statedAmount?: number;

  // LLM-classified budget category this expense counts against — see Request.budgetDepartment.
  @IsString()
  @IsOptional()
  @MaxLength(120)
  budgetDepartment?: string;

  // Exact EmployeeRole name this request should route to (e.g. "Human
  // Resources (HR)") — resolved to Request.routedRoleId at creation time.
  // See RequestsService.create.
  @IsString()
  @IsOptional()
  @MaxLength(120)
  routeToRoleName?: string;

  // Whether routeToRoleName means "a role-holder must actually decide this"
  // (PENDING_ROLE_APPROVAL) vs. "just log/forward it, nothing to approve"
  // (NOTED). Ignored when routeToRoleName is absent.
  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  // ISO date strings (YYYY-MM-DD) for a leave request — see Request.leaveStartDate/EndDate.
  @IsDateString()
  @IsOptional()
  leaveStartDate?: string;

  @IsDateString()
  @IsOptional()
  leaveEndDate?: string;
}
