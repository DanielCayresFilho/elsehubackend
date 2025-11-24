import { MessageDirection, MessageVia } from '@prisma/client';

export class MessageResponseDto {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName?: string | null;
  content: string;
  hasMedia: boolean;
  mediaType?: string | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaCaption?: string | null;
  mediaDownloadPath?: string | null;
  direction: MessageDirection;
  via: MessageVia;
  externalId: string | null;
  status: string | null;
  createdAt: Date;
}

