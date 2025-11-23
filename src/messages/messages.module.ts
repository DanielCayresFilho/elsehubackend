import { Module, forwardRef } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { WebSocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [forwardRef(() => WebSocketsModule)],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}

