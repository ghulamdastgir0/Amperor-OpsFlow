import { RequestChannel } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateRequestDto {
  @IsEnum(RequestChannel)
  channel: RequestChannel;

  @IsString()
  rawPrompt: string;

  @IsString()
  @IsOptional()
  parsedIntent?: string;

  // LLM-extracted, unverified amount mentioned in chat — see Request.statedAmount.
  @IsNumber()
  @IsPositive()
  @IsOptional()
  statedAmount?: number;

  // LLM-classified budget category this expense counts against — see Request.budgetDepartment.
  @IsString()
  @IsOptional()
  budgetDepartment?: string;

  // Exact EmployeeRole name this request should route to (e.g. "Human
  // Resources (HR)") — resolved to Request.routedRoleId at creation time.
  // See RequestsService.create.
  @IsString()
  @IsOptional()
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
