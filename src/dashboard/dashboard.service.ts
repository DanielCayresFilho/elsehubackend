import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId?: string, userRole?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Conversas Ativas
    const activeConversationsWhere: Prisma.ConversationWhereInput = {
      status: 'OPEN',
    };
    if (userRole === 'OPERATOR') {
      activeConversationsWhere.operatorId = userId;
    }
    const activeConversations = await this.prisma.conversation.count({
      where: activeConversationsWhere,
    });

    // Mensagens Hoje
    const messagesTodayWhere: Prisma.MessageWhereInput = {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    };
    if (userRole === 'OPERATOR') {
      messagesTodayWhere.conversation = {
        operatorId: userId,
      };
    }
    const totalMessages = await this.prisma.message.count({
      where: messagesTodayWhere,
    });

    // Taxa de Resposta e Tempo Médio de Resposta
    const finishedConversationsWhere: Prisma.FinishedConversationWhereInput = {};
    if (userRole === 'OPERATOR') {
      finishedConversationsWhere.operatorId = userId;
    }

    const finishedConversations = await this.prisma.finishedConversation.findMany({
      where: finishedConversationsWhere,
      select: {
        avgResponseTimeOperator: true,
        avgResponseTimeUser: true,
      },
    });

    // Calcular taxa de resposta (conversas com resposta do operador / total)
    // Taxa de resposta = (conversas onde operador respondeu / total de conversas) * 100
    const conversationsWithOperatorResponse = finishedConversations.filter(
      (c) => c.avgResponseTimeOperator !== null && c.avgResponseTimeOperator > 0,
    ).length;
    const totalFinishedConversations = finishedConversations.length;
    const responseRate =
      totalFinishedConversations > 0
        ? Math.round(
            (conversationsWithOperatorResponse / totalFinishedConversations) * 100,
          )
        : 0;

    // Calcular tempo médio de resposta
    const responseTimes = finishedConversations
      .filter((c) => c.avgResponseTimeOperator !== null)
      .map((c) => c.avgResponseTimeOperator ?? 0);

    const averageResponseTime =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length,
          )
        : 0;

    return {
      activeConversations,
      totalMessages,
      responseRate,
      averageResponseTime, // em segundos
    };
  }

  async getRecentConversations(userId?: string, userRole?: string, limit = 5) {
    const where: Prisma.ConversationWhereInput = {
      status: 'OPEN',
    };

    if (userRole === 'OPERATOR') {
      where.operatorId = userId;
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        operator: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    return conversations.map((conv) => {
      const lastMessage = conv.messages[0];
      return {
        id: conv.id,
        contactName: conv.contact?.name || 'Sem nome',
        contactPhone: conv.contact?.phone,
        operatorName: conv.operator?.name || null,
        lastMessage: lastMessage?.content || null,
        lastMessageAt: lastMessage?.createdAt || conv.startTime,
        startTime: conv.startTime,
        messageCount: conv.messages.length,
      };
    });
  }

  async getWeeklyPerformance(userId?: string, userRole?: string) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const where: Prisma.FinishedConversationWhereInput = {
      endTime: {
        gte: startOfWeek,
      },
    };

    if (userRole === 'OPERATOR') {
      where.operatorId = userId;
    }

    const finishedConversations = await this.prisma.finishedConversation.findMany({
      where,
      select: {
        avgResponseTimeOperator: true,
        avgResponseTimeUser: true,
        endTime: true,
      },
    });

    // Agrupar por dia
    const dailyStats: Record<
      string,
      {
        date: string;
        responseRate: number;
        averageResponseTime: number;
        closedConversations: number;
      }
    > = {};

    // Inicializar últimos 7 dias
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = {
        date: dateKey,
        responseRate: 0,
        averageResponseTime: 0,
        closedConversations: 0,
      };
    }

    // Processar conversas finalizadas
    finishedConversations.forEach((conv) => {
      const dateKey = new Date(conv.endTime).toISOString().split('T')[0];
      if (dailyStats[dateKey]) {
        dailyStats[dateKey].closedConversations += 1;
        if (conv.avgResponseTimeOperator !== null) {
          dailyStats[dateKey].averageResponseTime +=
            conv.avgResponseTimeOperator;
        }
      }
    });

    // Agrupar conversas por dia para calcular taxa de resposta corretamente
    const conversationsByDay: Record<string, any[]> = {};
    finishedConversations.forEach((conv) => {
      const dateKey = new Date(conv.endTime).toISOString().split('T')[0];
      if (!conversationsByDay[dateKey]) {
        conversationsByDay[dateKey] = [];
      }
      conversationsByDay[dateKey].push(conv);
    });

    // Calcular médias
    const weeklyData = Object.values(dailyStats).map((day) => {
      const conversations = day.closedConversations;
      const dayConversations = conversationsByDay[day.date] || [];
      
      const avgTime =
        conversations > 0
          ? Math.round(day.averageResponseTime / conversations)
          : 0;
      
      // Taxa de resposta = conversas com resposta do operador / total
      const withResponse = dayConversations.filter(
        (c) => c.avgResponseTimeOperator !== null && c.avgResponseTimeOperator > 0,
      ).length;
      const responseRate =
        conversations > 0 ? Math.round((withResponse / conversations) * 100) : 0;

      return {
        date: day.date,
        responseRate: responseRate,
        averageResponseTime: avgTime,
        closedConversations: conversations,
      };
    });

    return weeklyData;
  }
}

