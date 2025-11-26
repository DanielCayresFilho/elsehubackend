import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createObjectCsvStringifier } from 'csv-writer';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { FinishedConversationResponseDto } from './dto/finished-conversation-response.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getFinishedConversations(query: ReportQueryDto) {
    const where: Prisma.FinishedConversationWhereInput = {};

    if (query.startDate || query.endDate) {
      where.endTime = {};
      if (query.startDate) {
        where.endTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.endTime.lte = new Date(query.endDate);
      }
    }

    if (query.operatorId) {
      where.operatorId = query.operatorId;
    }

    if (query.tabulationId) {
      where.tabulationId = query.tabulationId;
    }

    const conversations = await this.prisma.finishedConversation.findMany({
      where,
      include: {
        tabulation: true,
      },
      orderBy: { endTime: 'desc' },
    });

    return conversations.map((conv) => this.toResponse(conv));
  }

  async exportFinishedConversationsCsv(
    query: ReportQueryDto,
  ): Promise<string> {
    const conversations = await this.getFinishedConversations(query);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'contactName', title: 'Nome do Contato' },
        { id: 'contactPhone', title: 'Telefone' },
        { id: 'operatorName', title: 'Operador' },
        { id: 'startTime', title: 'Início' },
        { id: 'endTime', title: 'Fim' },
        { id: 'durationSeconds', title: 'Duração (s)' },
        { id: 'avgResponseTimeUser', title: 'TMA Cliente (s)' },
        { id: 'avgResponseTimeOperator', title: 'TMA Operador (s)' },
        { id: 'tabulationName', title: 'Tabulação' },
      ],
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(conversations);

    return csvContent;
  }

  async getStatistics(query: ReportQueryDto) {
    const where: Prisma.FinishedConversationWhereInput = {};

    if (query.startDate || query.endDate) {
      where.endTime = {};
      if (query.startDate) {
        where.endTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.endTime.lte = new Date(query.endDate);
      }
    }

    if (query.operatorId) {
      where.operatorId = query.operatorId;
    }

    if (query.tabulationId) {
      where.tabulationId = query.tabulationId;
    }

    const [totalConversations, conversations] = await Promise.all([
      this.prisma.finishedConversation.count({ where }),
      this.prisma.finishedConversation.findMany({
        where,
        select: {
          durationSeconds: true,
          avgResponseTimeUser: true,
          avgResponseTimeOperator: true,
          tabulationId: true,
        },
      }),
    ]);

    const totalDuration = conversations.reduce(
      (sum, conv) => sum + conv.durationSeconds,
      0,
    );
    const avgDuration =
      totalConversations > 0 ? totalDuration / totalConversations : 0;

    const responseTimes = conversations.filter(
      (c) => c.avgResponseTimeOperator !== null,
    );
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce(
            (sum, c) => sum + (c.avgResponseTimeOperator ?? 0),
            0,
          ) / responseTimes.length
        : 0;

    // Agrupar por tabulação
    const tabulationCounts: Record<string, number> = {};
    conversations.forEach((conv) => {
      tabulationCounts[conv.tabulationId] =
        (tabulationCounts[conv.tabulationId] || 0) + 1;
    });

    const tabulations = await this.prisma.tabulation.findMany({
      where: {
        id: { in: Object.keys(tabulationCounts) },
      },
    });

    const tabulationStats = tabulations.map((tab) => ({
      tabulationId: tab.id,
      tabulationName: tab.name,
      count: tabulationCounts[tab.id],
    }));

    // Calcular taxa de resposta
    const conversationsWithResponse = conversations.filter(
      (c) => c.avgResponseTimeOperator !== null && c.avgResponseTimeOperator > 0,
    ).length;
    const responseRate =
      totalConversations > 0
        ? Math.round((conversationsWithResponse / totalConversations) * 100)
        : 0;

    return {
      totalConversations,
      avgDurationSeconds: Math.round(avgDuration),
      avgResponseTimeSeconds: Math.round(avgResponseTime),
      responseRate,
      tabulationStats,
    };
  }

  async getOperatorPerformance(query: ReportQueryDto) {
    const where: Prisma.FinishedConversationWhereInput = {};

    if (query.startDate || query.endDate) {
      where.endTime = {};
      if (query.startDate) {
        where.endTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.endTime.lte = new Date(query.endDate);
      }
    }

    const conversations = await this.prisma.finishedConversation.findMany({
      where,
      include: {
        operator: true,
      },
    });

    // Buscar mensagens dos operadores no período
    const messageWhere: Prisma.MessageWhereInput = {
      direction: 'OUTBOUND',
      senderId: { not: null },
    };

    if (query.startDate || query.endDate) {
      messageWhere.createdAt = {};
      if (query.startDate) {
        messageWhere.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        messageWhere.createdAt.lte = new Date(query.endDate);
      }
    }

    const messages = await this.prisma.message.findMany({
      where: messageWhere,
      select: {
        senderId: true,
      },
    });

    // Contar mensagens por operador
    const messageCounts: Record<string, number> = {};
    messages.forEach((msg) => {
      if (msg.senderId) {
        messageCounts[msg.senderId] = (messageCounts[msg.senderId] || 0) + 1;
      }
    });

    // Agrupar por operador
    const operatorStats: Record<
      string,
      {
        operatorId: string;
        operatorName: string;
        totalConversations: number;
        totalMessages: number;
        avgDuration: number;
        avgResponseTime: number;
      }
    > = {};

    conversations.forEach((conv) => {
      if (!operatorStats[conv.operatorId]) {
        operatorStats[conv.operatorId] = {
          operatorId: conv.operatorId,
          operatorName: conv.operatorName,
          totalConversations: 0,
          totalMessages: messageCounts[conv.operatorId] || 0,
          avgDuration: 0,
          avgResponseTime: 0,
        };
      }

      const stats = operatorStats[conv.operatorId];
      stats.totalConversations += 1;
      stats.avgDuration += conv.durationSeconds;
      stats.avgResponseTime += conv.avgResponseTimeOperator ?? 0;
    });

    // Calcular médias
    const result = Object.values(operatorStats).map((stat) => ({
      ...stat,
      avgDuration: Math.round(stat.avgDuration / stat.totalConversations),
      avgResponseTime: Math.round(
        stat.avgResponseTime / stat.totalConversations,
      ),
    }));

    return result;
  }

  async exportStatisticsCsv(query: ReportQueryDto): Promise<string> {
    const statistics = await this.getStatistics(query);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'metric', title: 'Métrica' },
        { id: 'value', title: 'Valor' },
      ],
    });

    const records = [
      { metric: 'Total de Conversas', value: statistics.totalConversations },
      { metric: 'Duração Média (segundos)', value: statistics.avgDurationSeconds },
      { metric: 'Tempo Médio de Resposta (segundos)', value: statistics.avgResponseTimeSeconds },
      ...statistics.tabulationStats.map((tab) => ({
        metric: `Tabulação: ${tab.tabulationName}`,
        value: tab.count,
      })),
    ];

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);

    return csvContent;
  }

  async exportOperatorPerformanceCsv(query: ReportQueryDto): Promise<string> {
    const performance = await this.getOperatorPerformance(query);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'operatorName', title: 'Nome do Operador' },
        { id: 'totalConversations', title: 'Total de Conversas' },
        { id: 'avgDuration', title: 'Duração Média (s)' },
        { id: 'avgResponseTime', title: 'Tempo Médio de Resposta (s)' },
      ],
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(performance);

    return csvContent;
  }

  async exportCampaignsCsv(query: ReportQueryDto): Promise<string> {
    const where: Prisma.CampaignWhereInput = {};

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.serviceInstanceId) {
      where.serviceInstanceId = query.serviceInstanceId;
    }

    const campaigns = await this.prisma.campaign.findMany({
      where,
      include: {
        serviceInstance: true,
        template: true,
        supervisor: true,
        items: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const records = campaigns.map((campaign) => {
      const items = campaign.items || [];
      const totalContacts = items.length;
      const sentCount = items.filter((i) => i.status === 'SENT').length;
      const failedCount = items.filter((i) => i.status === 'FAILED').length;
      const pendingCount = items.filter((i) => i.status === 'PENDING').length;

      return {
        name: campaign.name,
        serviceInstanceName: campaign.serviceInstance?.name || 'N/A',
        templateName: campaign.template?.name || 'N/A',
        supervisorName: campaign.supervisor?.name || 'N/A',
        status: campaign.status,
        delaySeconds: campaign.delaySeconds,
        totalContacts,
        sentCount,
        failedCount,
        pendingCount,
        createdAt: campaign.createdAt.toISOString(),
        startedAt: campaign.startedAt?.toISOString() || 'N/A',
        finishedAt: campaign.finishedAt?.toISOString() || 'N/A',
      };
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'name', title: 'Nome da Campanha' },
        { id: 'serviceInstanceName', title: 'Instância' },
        { id: 'templateName', title: 'Template' },
        { id: 'supervisorName', title: 'Supervisor' },
        { id: 'status', title: 'Status' },
        { id: 'delaySeconds', title: 'Delay (s)' },
        { id: 'totalContacts', title: 'Total de Contatos' },
        { id: 'sentCount', title: 'Enviadas' },
        { id: 'failedCount', title: 'Falhadas' },
        { id: 'pendingCount', title: 'Pendentes' },
        { id: 'createdAt', title: 'Criada em' },
        { id: 'startedAt', title: 'Iniciada em' },
        { id: 'finishedAt', title: 'Finalizada em' },
      ],
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);

    return csvContent;
  }

  async exportMessagesCsv(query: ReportQueryDto): Promise<string> {
    const where: Prisma.MessageWhereInput = {};

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.serviceInstanceId) {
      where.conversation = {
        serviceInstanceId: query.serviceInstanceId,
      };
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        conversation: {
          include: {
            contact: true,
            serviceInstance: true,
            operator: true,
          },
        },
        sender: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limite para evitar arquivos muito grandes
    });

    const records = messages.map((message) => ({
      id: message.id,
      contactName: message.conversation.contact?.name || 'N/A',
      contactPhone: message.conversation.contact?.phone || 'N/A',
      operatorName: message.sender?.name || message.conversation.operator?.name || 'Sistema',
      serviceInstanceName: message.conversation.serviceInstance?.name || 'N/A',
      direction: message.direction,
      via: message.via,
      content: message.content.substring(0, 200), // Limitar tamanho do conteúdo
      status: message.status || 'N/A',
      createdAt: message.createdAt.toISOString(),
      hasMedia: message.mediaUrl ? 'Sim' : 'Não',
    }));

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: 'ID' },
        { id: 'contactName', title: 'Nome do Contato' },
        { id: 'contactPhone', title: 'Telefone' },
        { id: 'operatorName', title: 'Operador' },
        { id: 'serviceInstanceName', title: 'Instância' },
        { id: 'direction', title: 'Direção' },
        { id: 'via', title: 'Via' },
        { id: 'content', title: 'Conteúdo' },
        { id: 'status', title: 'Status' },
        { id: 'hasMedia', title: 'Tem Mídia' },
        { id: 'createdAt', title: 'Data/Hora' },
      ],
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records);

    return csvContent;
  }

  private toResponse(conv: any): FinishedConversationResponseDto {
    return {
      id: conv.id,
      originalChatId: conv.originalChatId,
      contactName: conv.contactName,
      contactPhone: conv.contactPhone,
      operatorName: conv.operatorName,
      operatorPhone: conv.operatorPhone,
      startTime: conv.startTime,
      endTime: conv.endTime,
      durationSeconds: conv.durationSeconds,
      avgResponseTimeUser: conv.avgResponseTimeUser,
      avgResponseTimeOperator: conv.avgResponseTimeOperator,
      tabulationName: conv.tabulation?.name,
    };
  }
}

