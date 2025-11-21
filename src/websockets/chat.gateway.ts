import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      
      if (!token) {
        this.logger.warn(`Cliente sem token tentou conectar: ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.access.secret'),
      });

      const userId = payload.sub;
      client.data.userId = userId;
      client.data.email = payload.email;
      client.data.role = payload.role;

      // Adicionar socket ao mapa de usuários conectados
      const sockets = this.connectedUsers.get(userId) || [];
      sockets.push(client.id);
      this.connectedUsers.set(userId, sockets);

      this.logger.log(`Cliente conectado: ${client.id} (User: ${userId})`);

      // Notificar outros que o usuário está online
      this.server.emit('user:online', { userId, email: payload.email });
    } catch (error) {
      this.logger.error(`Erro ao conectar cliente: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      const sockets = this.connectedUsers.get(userId) || [];
      const filtered = sockets.filter((id) => id !== client.id);

      if (filtered.length === 0) {
        this.connectedUsers.delete(userId);
        // Notificar que o usuário saiu
        this.server.emit('user:offline', { userId });
      } else {
        this.connectedUsers.set(userId, filtered);
      }
    }

    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const conversation = await this.conversationsService.findOne(
        data.conversationId,
      );

      client.join(`conversation:${data.conversationId}`);
      
      this.logger.log(
        `Cliente ${client.id} entrou na conversa ${data.conversationId}`,
      );

      return { success: true, conversation };
    } catch (error) {
      this.logger.error(`Erro ao entrar na conversa: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    
    this.logger.log(
      `Cliente ${client.id} saiu da conversa ${data.conversationId}`,
    );

    return { success: true };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    try {
      const userId = client.data.userId;

      const message = await this.messagesService.send(userId, {
        conversationId: data.conversationId,
        content: data.content,
      });

      // Enviar mensagem para todos na sala da conversa
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message:new', message);

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    const email = client.data.email;

    client
      .to(`conversation:${data.conversationId}`)
      .emit('typing:user', { userId, email, isTyping: true });

    return { success: true };
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    const email = client.data.email;

    client
      .to(`conversation:${data.conversationId}`)
      .emit('typing:user', { userId, email, isTyping: false });

    return { success: true };
  }

  // Métodos auxiliares para emitir eventos de fora do gateway
  emitNewMessage(conversationId: string, message: any) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);
  }

  emitConversationUpdate(conversationId: string, conversation: any) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('conversation:updated', conversation);
  }

  emitConversationClosed(conversationId: string) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('conversation:closed', { conversationId });
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Também aceitar token via query parameter
    const token = client.handshake.query.token;
    if (typeof token === 'string') {
      return token;
    }

    return null;
  }
}

