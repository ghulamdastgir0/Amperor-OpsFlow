import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDepartmentDto {
  @IsString()
  @IsOptional()
  department?: string;
}
