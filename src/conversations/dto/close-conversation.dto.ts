import { IsString, IsNotEmpty } from 'class-validator';

export class CloseConversationDto {
  @IsString()
  @IsNotEmpty()
  tabulationId: string;
}

