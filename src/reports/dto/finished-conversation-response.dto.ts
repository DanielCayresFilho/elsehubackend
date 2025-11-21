export class FinishedConversationResponseDto {
  id: string;
  originalChatId: string;
  contactName: string;
  contactPhone: string;
  operatorName: string;
  operatorPhone: string | null;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  avgResponseTimeUser: number | null;
  avgResponseTimeOperator: number | null;
  tabulationName: string;
}

