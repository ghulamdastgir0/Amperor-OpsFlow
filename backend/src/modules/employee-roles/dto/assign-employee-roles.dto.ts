import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignEmployeeRolesDto {
  // Full replacement set — not additive — so the UI can just submit whatever
  // is currently checked.
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employeeRoleIds: string[];
}
