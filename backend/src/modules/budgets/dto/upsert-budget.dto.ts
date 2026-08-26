import { IsNumber, IsString, Min } from 'class-validator';

export class UpsertBudgetDto {
  @IsString()
  departmentScope: string;

  // 0 is valid on purpose — creating a new department (e.g. from the "add
  // custom department" picker) shouldn't require inventing a real budget
  // figure just to register the name; a SYSTEM_ADMIN can set the real
  // allocation later from the Finance Dashboard.
  @IsNumber()
  @Min(0)
  allocatedAmount: number;
}
