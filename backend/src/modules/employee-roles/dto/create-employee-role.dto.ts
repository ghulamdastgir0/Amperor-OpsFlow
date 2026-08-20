import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEmployeeRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  // Required: this is what the assistant reads to decide which role a
  // filed request should route to, so an undescribed role can't be routed to.
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  description: string;
}
