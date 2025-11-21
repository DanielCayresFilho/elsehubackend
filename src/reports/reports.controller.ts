import { Controller, Get, Query } from '@nestjs/common';

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
  exportFinishedConversations(@Query() query: ReportQueryDto) {
    return this.reportsService.exportFinishedConversationsCsv(query);
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

