import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, ChatStatus, MessageDirection } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { CloseConversationDto } from './dto/close-conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    payload: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: payload.contactId },
    });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    const serviceInstance = await this.prisma.serviceInstance.findUnique({
      where: { id: payload.serviceInstanceId },
    });

    if (!serviceInstance) {
      throw new NotFoundException('Instância de serviço não encontrada');
    }

    if (!serviceInstance.isActive) {
      throw new BadRequestException('Instância de serviço inativa');
    }

    // Verificar se já existe conversa aberta para este contato
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        contactId: payload.contactId,
        status: ChatStatus.OPEN,
      },
    });

    if (existingConversation) {
      return this.findOne(existingConversation.id);
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        contactId: payload.contactId,
        serviceInstanceId: payload.serviceInstanceId,
        status: ChatStatus.OPEN,
      },
      include: {
        contact: true,
        serviceInstance: true,
        operator: true,
      },
    });

    return this.toResponse(conversation);
  }

  async findAll(query: ListConversationsQueryDto, user?: any) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.operatorId && { operatorId: query.operatorId }),
      ...(query.serviceInstanceId && {
        serviceInstanceId: query.serviceInstanceId,
      }),
      ...(query.search && {
        contact: {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        },
      }),
    };

    // OPERADORES só veem suas próprias conversas
    if (user && user.role === 'OPERATOR') {
      where.operatorId = user.id;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        include: {
          contact: true,
          serviceInstance: true,
          operator: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { startTime: 'desc' },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: data.map((conv) => this.toResponse(conv)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string): Promise<ConversationResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        serviceInstance: true,
        operator: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    return this.toResponse(conversation);
  }

  async assignOperator(
    id: string,
    payload: AssignConversationDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    if (conversation.status !== ChatStatus.OPEN) {
      throw new BadRequestException(
        'Não é possível atribuir operador a uma conversa fechada',
      );
    }

    const operator = await this.prisma.user.findUnique({
      where: { id: payload.operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operador não encontrado');
    }

    if (!operator.isActive) {
      throw new BadRequestException('Operador inativo');
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        operatorId: payload.operatorId,
      },
      include: {
        contact: true,
        serviceInstance: true,
        operator: true,
      },
    });

    // Atualizar timestamp do operador para distribuição justa
    await this.prisma.user.update({
      where: { id: payload.operatorId },
      data: {
        lastConversationAssignedAt: new Date(),
      },
    });

    return this.toResponse(updated);
  }

  async closeConversation(
    id: string,
    userId: string,
    payload: CloseConversationDto,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        operator: true,
        serviceInstance: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    if (conversation.status === ChatStatus.CLOSED) {
      throw new BadRequestException('Conversa já está fechada');
    }

    const tabulation = await this.prisma.tabulation.findUnique({
      where: { id: payload.tabulationId },
    });

    if (!tabulation) {
      throw new NotFoundException('Tabulação não encontrada');
    }

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime.getTime() - conversation.startTime.getTime()) / 1000,
    );

    // Calcular tempos médios de resposta
    const { avgResponseTimeUser, avgResponseTimeOperator } =
      this.calculateResponseTimes(conversation.messages);

    // Criar registro de conversa finalizada
    await this.prisma.finishedConversation.create({
      data: {
        originalChatId: conversation.id,
        contactName: conversation.contact.name,
        contactPhone: conversation.contact.phone,
        operatorName: conversation.operator?.name ?? 'Sistema',
        operatorPhone: null, // Pode ser preenchido com dados da instância
        startTime: conversation.startTime,
        endTime,
        durationSeconds,
        avgResponseTimeUser,
        avgResponseTimeOperator,
        tabulationId: payload.tabulationId,
        operatorId: conversation.operatorId ?? userId,
        contactId: conversation.contactId,
      },
    });

    // Fechar a conversa
    await this.prisma.conversation.update({
      where: { id },
      data: {
        status: ChatStatus.CLOSED,
      },
    });
  }

  async getQueuedConversations() {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        status: ChatStatus.OPEN,
        operatorId: null,
      },
      include: {
        contact: true,
        serviceInstance: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return conversations.map((conv) => this.toResponse(conv));
  }

  private calculateResponseTimes(messages: any[]): {
    avgResponseTimeUser: number | null;
    avgResponseTimeOperator: number | null;
  } {
    if (messages.length < 2) {
      return {
        avgResponseTimeUser: null,
        avgResponseTimeOperator: null,
      };
    }

    const userTimes: number[] = [];
    const operatorTimes: number[] = [];

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];

      const timeDiff = Math.floor(
        (new Date(current.createdAt).getTime() -
          new Date(previous.createdAt).getTime()) /
          1000,
      );

      if (
        current.direction === MessageDirection.INBOUND &&
        previous.direction === MessageDirection.OUTBOUND
      ) {
        userTimes.push(timeDiff);
      } else if (
        current.direction === MessageDirection.OUTBOUND &&
        previous.direction === MessageDirection.INBOUND
      ) {
        operatorTimes.push(timeDiff);
      }
    }

    const avgUser =
      userTimes.length > 0
        ? Math.floor(userTimes.reduce((a, b) => a + b, 0) / userTimes.length)
        : null;

    const avgOperator =
      operatorTimes.length > 0
        ? Math.floor(
            operatorTimes.reduce((a, b) => a + b, 0) / operatorTimes.length,
          )
        : null;

    return {
      avgResponseTimeUser: avgUser,
      avgResponseTimeOperator: avgOperator,
    };
  }

  private toResponse(conversation: any): ConversationResponseDto {
    const messageCount =
      conversation._count?.messages ?? conversation.messages?.length ?? 0;
    const lastMessage = conversation.messages?.[0];

    return {
      id: conversation.id,
      contactId: conversation.contactId,
      contactName: conversation.contact?.name,
      contactPhone: conversation.contact?.phone,
      serviceInstanceId: conversation.serviceInstanceId,
      serviceInstanceName: conversation.serviceInstance?.name,
      operatorId: conversation.operatorId,
      operatorName: conversation.operator?.name ?? null,
      status: conversation.status,
      startTime: conversation.startTime,
      messageCount,
      lastMessageAt: lastMessage?.createdAt,
    };
  }
}

