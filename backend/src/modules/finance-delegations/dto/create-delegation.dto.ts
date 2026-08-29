import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateDelegationDto {
  @IsUUID()
  delegateManagerId: string;

  @IsString()
  @MaxLength(120)
  departmentScope: string;

  // maxApprovalLimit is Decimal(12,2) — keep it inside range so an
  // out-of-bounds figure is a 400, not a numeric-overflow 500.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9_999_999_999)
  maxApprovalLimit: number;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;
}
