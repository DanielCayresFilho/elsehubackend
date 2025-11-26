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
}

