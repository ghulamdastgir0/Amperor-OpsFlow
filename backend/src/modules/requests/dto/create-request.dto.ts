import { RequestChannel } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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
}
