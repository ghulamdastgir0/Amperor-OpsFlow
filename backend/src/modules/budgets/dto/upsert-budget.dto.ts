import { IsNumber, IsPositive, IsString } from 'class-validator';

export class UpsertBudgetDto {
  @IsString()
  departmentScope: string;

  @IsNumber()
  @IsPositive()
  allocatedAmount: number;
}
