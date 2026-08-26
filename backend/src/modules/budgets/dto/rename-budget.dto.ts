import { IsString, MinLength } from 'class-validator';

export class RenameBudgetDto {
  @IsString()
  @MinLength(1)
  departmentScope: string;
}
