import { Controller, Get } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getStats(user.id, user.role);
  }

  @Get('recent-conversations')
  getRecentConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getRecentConversations(user.id, user.role);
  }

  @Get('weekly-performance')
  getWeeklyPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getWeeklyPerformance(user.id, user.role);
  }
}

