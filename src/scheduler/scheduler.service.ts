import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatStatus, MessageDirection } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly mediaRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.mediaRetentionDays =
      this.configService.get<number>('storage.mediaRetentionDays') ?? 3;
  }

  // Roda a cada hora
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldConversations() {
    this.logger.log('Verificando conversas para expirar (24h)...');

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Buscar tabulação de expiração automática
    let expiredTabulation = await this.prisma.tabulation.findFirst({
      where: { name: 'Conversa Expirada', isAutomatic: true },
    });

    // Criar tabulação se não existir
    if (!expiredTabulation) {
      expiredTabulation = await this.prisma.tabulation.create({
        data: {
          name: 'Conversa Expirada',
          isAutomatic: true,
        },
      });
      this.logger.log('Tabulação "Conversa Expirada" criada automaticamente');
    }

    // Buscar conversas abertas sem atividade há mais de 24h
    const conversations = await this.prisma.conversation.findMany({
      where: {
        status: ChatStatus.OPEN,
        startTime: {
          lt: twentyFourHoursAgo,
        },
      },
      include: {
        contact: true,
        operator: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let expiredCount = 0;

    for (const conversation of conversations) {
      // Verificar última mensagem (mais preciso que startTime)
      const lastMessage = conversation.messages[0];
      const lastActivity = lastMessage
        ? lastMessage.createdAt
        : conversation.startTime;

      if (lastActivity < twentyFourHoursAgo) {
        await this.expireConversation(conversation, expiredTabulation.id);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`${expiredCount} conversas expiradas automaticamente`);
    } else {
      this.logger.log('Nenhuma conversa expirada');
    }
  }

  private async expireConversation(conversation: any, tabulationId: string) {
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
        operatorName: conversation.operator?.name ?? 'Sistema (Auto-Expirado)',
        operatorPhone: null,
        startTime: conversation.startTime,
        endTime,
        durationSeconds,
        avgResponseTimeUser,
        avgResponseTimeOperator,
        tabulationId,
        operatorId: conversation.operatorId ?? conversation.contact.id, // Fallback
        contactId: conversation.contactId,
      },
    });

    // Fechar a conversa
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ChatStatus.CLOSED,
      },
    });

    this.logger.log(
      `Conversa ${conversation.id} (contato: ${conversation.contact.name}) expirada após 24h`,
    );
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

    // Inverter porque veio desc
    const sortedMessages = [...messages].reverse();

    for (let i = 1; i < sortedMessages.length; i++) {
      const current = sortedMessages[i];
      const previous = sortedMessages[i - 1];

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

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredMedia() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.mediaRetentionDays);

    const batchSize = 200;
    let totalRemoved = 0;

    while (true) {
      const messages = await this.prisma.message.findMany({
        where: {
          mediaStoragePath: { not: null },
          createdAt: { lt: cutoff },
        },
        select: { id: true, mediaStoragePath: true },
        take: batchSize,
      });

      if (messages.length === 0) {
        break;
      }

      for (const message of messages) {
        if (message.mediaStoragePath) {
          await this.storageService.deleteFile(message.mediaStoragePath);
        }
      }

      await this.prisma.message.updateMany({
        where: { id: { in: messages.map((msg) => msg.id) } },
        data: { mediaStoragePath: null },
      });

      totalRemoved += messages.length;

      if (messages.length < batchSize) {
        break;
      }
    }

    if (totalRemoved > 0) {
      this.logger.log(
        `${totalRemoved} mídias antigas removidas (> ${this.mediaRetentionDays} dias)`,
      );
    } else {
      this.logger.debug('Nenhuma mídia antiga para remover');
    }
  }
}

