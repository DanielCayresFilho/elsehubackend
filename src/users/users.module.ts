import { Module, forwardRef } from '@nestjs/common';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    forwardRef(() => ConversationsModule),
    forwardRef(() => WebsocketsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
