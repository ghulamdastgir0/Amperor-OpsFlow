import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class SendBroadcastDto {
  // At least one of employeeRoleIds/roles must be non-empty — enforced in
  // EmployeeRolesService.broadcast rather than here, since class-validator
  // doesn't cleanly express "at least one of these two arrays".
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employeeRoleIds?: string[];

  // Fixed platform roles (Employee, Finance Approver, System Admin, etc.) —
  // a separate targeting axis from the tenant's custom EmployeeRole catalog,
  // e.g. "message everyone with Finance Approver access" regardless of
  // whether they're also tagged HR/IT/etc.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
