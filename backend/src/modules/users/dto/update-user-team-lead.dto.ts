import { IsOptional, IsUUID } from 'class-validator';

export class UpdateUserTeamLeadDto {
  // Omit/null to clear the assignment.
  @IsOptional()
  @IsUUID('4')
  teamLeadId?: string | null;
}
