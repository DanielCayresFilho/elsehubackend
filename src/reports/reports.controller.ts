import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('finished-conversations')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  getFinishedConversations(@Query() query: ReportQueryDto) {
    return this.reportsService.getFinishedConversations(query);
  }

  @Get('finished-conversations/export')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async exportFinishedConversations(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csvContent = await this.reportsService.exportFinishedConversationsCsv(query);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `conversas-finalizadas-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }

  @Get('statistics')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  getStatistics(@Query() query: ReportQueryDto) {
    return this.reportsService.getStatistics(query);
  }

  @Get('operator-performance')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  getOperatorPerformance(@Query() query: ReportQueryDto) {
    return this.reportsService.getOperatorPerformance(query);
  }

  @Get('statistics/export')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async exportStatistics(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csvContent = await this.reportsService.exportStatisticsCsv(query);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `estatisticas-gerais-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }

  @Get('operator-performance/export')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async exportOperatorPerformance(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csvContent = await this.reportsService.exportOperatorPerformanceCsv(query);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `performance-operadores-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }

  @Get('campaigns/export')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async exportCampaigns(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csvContent = await this.reportsService.exportCampaignsCsv(query);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `relatorio-campanhas-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }

  @Get('messages/export')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async exportMessages(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csvContent = await this.reportsService.exportMessagesCsv(query);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `relatorio-mensagens-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  }
}

