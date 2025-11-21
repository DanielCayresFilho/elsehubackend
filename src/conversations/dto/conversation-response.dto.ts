import { ChatStatus } from '@prisma/client';

export class ConversationResponseDto {
  id: string;
  contactId: string;
  contactName?: string;
  contactPhone?: string;
  serviceInstanceId: string;
  serviceInstanceName?: string;
  operatorId: string | null;
  operatorName?: string | null;
  status: ChatStatus;
  startTime: Date;
  messageCount?: number;
  lastMessageAt?: Date;
}

