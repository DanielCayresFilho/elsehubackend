import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';

import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() sendDto: SendMessageDto,
  ) {
    return this.messagesService.send(user.id, sendDto);
  }

  @Get('conversation/:conversationId')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findByConversation(
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.findByConversation(conversationId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findOne(@Param('id') id: string) {
    return this.messagesService.findOne(id);
  }
}

