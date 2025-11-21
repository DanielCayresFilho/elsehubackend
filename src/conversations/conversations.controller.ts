import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { CloseConversationDto } from './dto/close-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  create(@Body() createDto: CreateConversationDto) {
    return this.conversationsService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findAll(
    @Query() query: ListConversationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.findAll(query, user);
  }

  @Get('queue')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  getQueue() {
    return this.conversationsService.getQueuedConversations();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  assignOperator(
    @Param('id') id: string,
    @Body() assignDto: AssignConversationDto,
  ) {
    return this.conversationsService.assignOperator(id, assignDto);
  }

  @Post(':id/close')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  closeConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() closeDto: CloseConversationDto,
  ) {
    return this.conversationsService.closeConversation(
      id,
      user.id,
      closeDto,
    );
  }
}

