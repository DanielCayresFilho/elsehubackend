import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Message, MessageDirection, MessageVia, ChatStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(
    userId: string,
    payload: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: payload.conversationId },
      include: {
        contact: true,
        serviceInstance: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    if (conversation.status !== ChatStatus.OPEN) {
      throw new BadRequestException('Não é possível enviar mensagem para conversa fechada');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        senderId: userId,
        content: payload.content,
        direction: MessageDirection.OUTBOUND,
        via: payload.via ?? MessageVia.CHAT_MANUAL,
        status: 'pending', // Será atualizado após envio real
      },
      include: {
        sender: true,
      },
    });

    // TODO: Integrar com provedor real (Meta/Evolution) para enviar mensagem
    // Por enquanto, apenas simulamos o envio marcando como 'sent'
    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'sent',
        externalId: `sim_${Date.now()}`, // Simula ID externo
      },
    });

    return this.toResponse(message);
  }

  async receiveInbound(data: {
    conversationId: string;
    content: string;
    externalId?: string;
  }): Promise<MessageResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: null, // Cliente não tem userId
        content: data.content,
        direction: MessageDirection.INBOUND,
        via: MessageVia.INBOUND,
        externalId: data.externalId ?? null,
        status: 'received',
      },
    });

    return this.toResponse(message);
  }

  async findByConversation(conversationId: string, query: ListMessagesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        include: {
          sender: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      data: data.map((message) => this.toResponse(message)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string): Promise<MessageResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        sender: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    return this.toResponse(message);
  }

  async updateStatus(messageId: string, status: string, externalId?: string): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        status,
        ...(externalId && { externalId }),
      },
    });
  }

  private toResponse(message: Message & { sender?: { name: string } | null }): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender?.name ?? null,
      content: message.content,
      direction: message.direction,
      via: message.via,
      externalId: message.externalId,
      status: message.status,
      createdAt: message.createdAt,
    };
  }
}

