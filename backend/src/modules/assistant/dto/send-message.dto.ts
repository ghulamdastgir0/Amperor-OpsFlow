import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content: string;
}
