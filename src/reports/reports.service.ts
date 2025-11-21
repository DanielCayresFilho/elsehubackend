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
  ): Promise<{ filePath: string; filename: string }> {
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `relatorio-atendimentos-${timestamp}.csv`;

    const savedFile = await this.storageService.saveFile({
      buffer: Buffer.from(csvContent, 'utf-8'),
      originalName: filename,
      subdirectory: 'reports',
    });

    return {
      filePath: savedFile.relativePath,
      filename: savedFile.filename,
    };
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

    return {
      totalConversations,
      avgDurationSeconds: Math.round(avgDuration),
      avgResponseTimeSeconds: Math.round(avgResponseTime),
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

    // Agrupar por operador
    const operatorStats: Record<
      string,
      {
        operatorId: string;
        operatorName: string;
        totalConversations: number;
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

