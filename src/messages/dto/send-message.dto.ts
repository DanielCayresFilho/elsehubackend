import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { MessageVia } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(MessageVia)
  @IsOptional()
  via?: MessageVia;
}

