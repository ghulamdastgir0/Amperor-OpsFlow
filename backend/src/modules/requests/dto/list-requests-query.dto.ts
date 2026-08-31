import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListRequestsQueryDto {
  // An unrecognised value used to be silently coerced to "no filter" and the
  // full list returned; now it's a 400 via the global ValidationPipe.
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
