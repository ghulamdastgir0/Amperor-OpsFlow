import { IsBoolean } from 'class-validator';

export class UpdateUserLeaveStatusDto {
  @IsBoolean()
  isOnLeave!: boolean;
}
