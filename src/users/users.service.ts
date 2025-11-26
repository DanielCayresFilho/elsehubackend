import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User, ChatStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatGateway } from '../websockets/chat.gateway';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(payload: CreateUserDto): Promise<UserResponseDto> {
    console.log('[UsersService] Creating user:', {
      name: payload.name,
      email: payload.email,
      role: payload.role,
      isActive: payload.isActive,
    });

    await this.ensureEmailAvailable(payload.email);

    const hashedPassword = await bcrypt.hash(payload.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          password: hashedPassword,
          role: payload.role,
          isActive: payload.isActive ?? true,
        },
      });

      console.log('[UsersService] User created successfully:', user.id);
      return this.toResponse(user);
    } catch (error) {
      console.error('[UsersService] Error creating user:', error);
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: data.map((user) => this.toResponse(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.toResponse(user);
  }

  async update(id: string, payload: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (payload.email && payload.email !== user.email) {
      await this.ensureEmailAvailable(payload.email);
    }

    let password = user.password;
    if (payload.password) {
      password = await bcrypt.hash(payload.password, 12);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: payload.name ?? user.name,
        email: payload.email ?? user.email,
        role: payload.role ?? user.role,
        isActive: payload.isActive ?? user.isActive,
        password,
      },
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.user.delete({ where: { id } });
  }

  async toggleOnlineStatus(userId: string, isOnline: boolean): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        onlineSince: isOnline ? new Date() : null,
      },
    });

    // Se o operador ficou online, tentar atribuir conversas da fila
    if (isOnline && (user.role === 'OPERATOR' || user.role === 'SUPERVISOR')) {
      await this.assignQueuedConversationsToOperator(userId);
    }

    return this.toResponse(updated);
  }

  /**
   * Atribui conversas da fila para um operador que acabou de ficar online
   */
  private async assignQueuedConversationsToOperator(operatorId: string): Promise<void> {
    try {
      // Buscar conversas na fila (sem operador atribuído)
      const queuedConversations = await this.prisma.conversation.findMany({
        where: {
          status: ChatStatus.OPEN,
          operatorId: null,
        },
        orderBy: { startTime: 'asc' }, // Mais antigas primeiro
        take: 1, // Atribuir apenas uma por vez para distribuir melhor
      });

      if (queuedConversations.length === 0) {
        this.logger.log(`Nenhuma conversa na fila para atribuir ao operador ${operatorId}`);
        return;
      }

      const conversation = queuedConversations[0];

      // Atribuir conversa ao operador
      await this.conversationsService.assignOperator(conversation.id, {
        operatorId,
      });

      // Atualizar timestamp do operador
      await this.prisma.user.update({
        where: { id: operatorId },
        data: {
          lastConversationAssignedAt: new Date(),
        },
      });

      this.logger.log(
        `Conversa ${conversation.id} atribuída automaticamente ao operador ${operatorId} ao ficar online`,
      );

      // Notificar via WebSocket
      const updatedConversation = await this.conversationsService.findOne(conversation.id);
      this.chatGateway.emitConversationUpdate(conversation.id, updatedConversation);

      // Notificar o operador especificamente
      this.chatGateway.server.emit('conversation:assigned', {
        conversationId: conversation.id,
        operatorId,
        conversation: updatedConversation,
      });
    } catch (error) {
      this.logger.error(
        `Erro ao atribuir conversas da fila ao operador ${operatorId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async getOnlineOperators(): Promise<UserResponseDto[]> {
    const operators = await this.prisma.user.findMany({
      where: {
        isOnline: true,
        isActive: true,
        role: { in: ['OPERATOR', 'SUPERVISOR'] },
      },
      orderBy: {
        lastConversationAssignedAt: 'asc', // Mais antigo primeiro (há mais tempo sem receber conversa)
      },
    });

    return operators.map((op) => this.toResponse(op));
  }

  toResponse(user: User): UserResponseDto {
    const { password: _password, ...rest } = user;
    void _password;
    return rest;
  }

  private async ensureEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('E-mail já está em uso');
    }
  }
}
