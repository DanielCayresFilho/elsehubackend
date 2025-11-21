import { MessageDirection, MessageVia } from '@prisma/client';

export class MessageResponseDto {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName?: string | null;
  content: string;
  direction: MessageDirection;
  via: MessageVia;
  externalId: string | null;
  status: string | null;
  createdAt: Date;
}

