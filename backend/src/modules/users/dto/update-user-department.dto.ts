import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDepartmentDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  department?: string;
}
