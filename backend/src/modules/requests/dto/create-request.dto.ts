import { RequestChannel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateRequestDto {
  @IsEnum(RequestChannel)
  channel: RequestChannel;

  @IsString()
  rawPrompt: string;

  @IsString()
  @IsOptional()
  parsedIntent?: string;
}
