import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDelegationDto {
  @IsUUID()
  delegateManagerId: string;

  @IsString()
  departmentScope: string;

  @IsNumber()
  @IsPositive()
  maxApprovalLimit: number;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;
}
