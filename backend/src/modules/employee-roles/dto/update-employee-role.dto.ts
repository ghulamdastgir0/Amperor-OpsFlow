import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmployeeRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  // Same rationale as CreateEmployeeRoleDto.description — this is what the
  // assistant reads to decide routing, so it must stay non-empty if edited.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  description?: string;
}
