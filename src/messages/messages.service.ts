import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Message, MessageDirection, MessageVia, ChatStatus } from '@prisma/client';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

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

    // Enviar mensagem via provedor (Evolution API ou Meta)
    try {
      if (conversation.serviceInstance.provider === 'EVOLUTION_API') {
        await this.sendViaEvolutionAPI(conversation, message);
      } else if (conversation.serviceInstance.provider === 'OFFICIAL_META') {
        // TODO: Implementar envio via Meta API
        this.logger.warn('Envio via Meta API ainda não implementado');
        await this.prisma.message.update({
          where: { id: message.id },
          data: {
            status: 'sent',
            externalId: `meta_${Date.now()}`,
          },
        });
      } else {
        throw new BadRequestException('Provedor não suportado');
      }
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem: ${error.message}`, error);
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'failed',
        },
      });
      throw new BadRequestException(`Falha ao enviar mensagem: ${error.message}`);
    }

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

  private async sendViaEvolutionAPI(conversation: any, message: Message): Promise<void> {
    const credentials = conversation.serviceInstance.credentials as Record<string, any>;
    const { serverUrl, apiToken, instanceName } = credentials;

    if (!serverUrl || !apiToken || !instanceName) {
      throw new BadRequestException('Credenciais da Evolution API incompletas');
    }

    const phone = conversation.contact.phone.replace(/[^\d+]/g, '');
    const sendUrl = `${serverUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

    this.logger.log(`Enviando mensagem via Evolution API: ${sendUrl}`, {
      phone,
      instanceName,
    });

    try {
      const response = await axios.post(
        sendUrl,
        {
          number: phone,
          text: message.content,
        },
        {
          headers: {
            apikey: apiToken,
            'Content-Type': 'application/json',
          },
        },
      );

      // A Evolution API retorna o ID da mensagem em key.id
      const externalId = response.data?.key?.id || response.data?.id || `evol_${Date.now()}`;
      // Status pode ser PENDING, SENT, DELIVERED, READ, etc.
      const status = response.data?.status?.toLowerCase() || 'sent';

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status,
          externalId,
        },
      });

      this.logger.log(`Mensagem enviada com sucesso: ${externalId}`);
    } catch (error: any) {
      this.logger.error('Erro ao enviar mensagem na Evolution API', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      throw new BadRequestException(
        `Falha ao enviar mensagem na Evolution API: ${error.response?.data?.message || error.message}`,
      );
    }
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

