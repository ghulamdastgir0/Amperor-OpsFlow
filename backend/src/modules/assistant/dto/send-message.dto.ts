import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  content: string;
}
