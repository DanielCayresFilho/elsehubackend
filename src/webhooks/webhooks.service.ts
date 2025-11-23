import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatStatus, MessageDirection } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatGateway } from '../websockets/chat.gateway';
import { MetaWebhookDto } from './dto/meta-webhook.dto';
import { EvolutionWebhookDto } from './dto/evolution-webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async handleMetaWebhook(payload: MetaWebhookDto): Promise<void> {
    this.logger.log('Webhook Meta recebido');

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.value.messages && change.value.messages.length > 0) {
          await this.processMetaMessages(change.value);
        }

        if (change.value.statuses && change.value.statuses.length > 0) {
          await this.processMetaStatuses(change.value.statuses);
        }
      }
    }
  }

  async handleEvolutionWebhook(payload: EvolutionWebhookDto): Promise<void> {
    this.logger.log(`Webhook Evolution recebido: ${payload.event}`, {
      instance: payload.instance,
      hasData: !!payload.data,
    });

    switch (payload.event) {
      case 'messages.upsert':
        await this.processEvolutionMessage(payload);
        break;
      case 'messages.update':
        await this.processEvolutionMessageUpdate(payload);
        break;
      default:
        this.logger.debug(`Evento Evolution não tratado: ${payload.event}`);
    }
  }

  private async processMetaMessages(value: any): Promise<void> {
    const phoneNumberId = value.metadata.phone_number_id;

    // Buscar a instância de serviço correspondente
    const serviceInstance = await this.findServiceInstanceByPhoneId(
      phoneNumberId,
    );

    if (!serviceInstance) {
      this.logger.warn(
        `Instância não encontrada para phoneId: ${phoneNumberId}`,
      );
      return;
    }

    for (const message of value.messages) {
      const contactPhone = this.normalizePhone(message.from);
      const messageText = this.extractMetaMessageText(message);

      if (!messageText) {
        this.logger.warn('Mensagem sem texto, pulando...');
        continue;
      }

      // Buscar ou criar contato
      let contact = await this.prisma.contact.findUnique({
        where: { phone: contactPhone },
      });

      if (!contact) {
        const contactName =
          value.contacts?.find((c: any) => c.wa_id === message.from)?.profile
            ?.name || contactPhone;

        contact = await this.prisma.contact.create({
          data: {
            name: contactName,
            phone: contactPhone,
          },
        });
      }

      // Buscar conversa aberta existente ou criar nova
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          serviceInstanceId: serviceInstance.id,
          status: ChatStatus.OPEN,
        },
      });

      if (!conversation) {
        // Buscar operador online há mais tempo sem receber conversa
        const availableOperator = await this.findAvailableOperator();

        conversation = await this.prisma.conversation.create({
          data: {
            contactId: contact.id,
            serviceInstanceId: serviceInstance.id,
            operatorId: availableOperator?.id,
            status: ChatStatus.OPEN,
          },
        });

        // Atualizar timestamp do operador
        if (availableOperator) {
          await this.prisma.user.update({
            where: { id: availableOperator.id },
            data: {
              lastConversationAssignedAt: new Date(),
            },
          });

          this.logger.log(
            `Conversa atribuída automaticamente ao operador: ${availableOperator.name}`,
          );
        } else {
          this.logger.warn('Nenhum operador online disponível. Conversa entrará na fila.');
        }
      }

      // Criar mensagem
      const newMessage = await this.messagesService.receiveInbound({
        conversationId: conversation.id,
        content: messageText,
        externalId: message.id,
      });

      // Notificar via WebSocket
      this.chatGateway.emitNewMessage(conversation.id, newMessage);

      this.logger.log(`Mensagem Meta processada: ${message.id}`);
    }
  }

  private async processMetaStatuses(statuses: any[]): Promise<void> {
    for (const status of statuses) {
      const message = await this.prisma.message.findFirst({
        where: { externalId: status.id },
      });

      if (message) {
        await this.messagesService.updateStatus(message.id, status.status);
        this.logger.log(
          `Status atualizado: ${status.id} -> ${status.status}`,
        );
      }
    }
  }

  private async processEvolutionMessage(payload: EvolutionWebhookDto): Promise<void> {
    const { instance, data } = payload;

    this.logger.log(`Processando mensagem Evolution`, {
      instance,
      fromMe: data.key?.fromMe,
      remoteJid: data.key?.remoteJid,
      hasMessage: !!data.message,
    });

    if (data.key?.fromMe) {
      // Mensagem enviada pelo sistema, ignorar
      this.logger.debug('Mensagem ignorada: fromMe = true');
      return;
    }

    // Buscar instância
    const serviceInstance = await this.findServiceInstanceByEvolutionName(
      instance,
    );

    if (!serviceInstance) {
      this.logger.warn(`Instância Evolution não encontrada: ${instance}`);
      return;
    }

    const contactPhone = this.normalizePhone(
      data.key?.remoteJid?.replace('@s.whatsapp.net', '') || '',
    );
    const messageText = this.extractEvolutionMessageText(data);

    if (!messageText) {
      this.logger.warn('Mensagem Evolution sem texto, pulando...');
      return;
    }

    // Buscar ou criar contato
    let contact = await this.prisma.contact.findUnique({
      where: { phone: contactPhone },
    });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          name: data.pushName || contactPhone,
          phone: contactPhone,
        },
      });
    }

      // Buscar conversa aberta existente ou criar nova
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          serviceInstanceId: serviceInstance.id,
          status: ChatStatus.OPEN,
        },
      });

      if (!conversation) {
        // Buscar operador online há mais tempo sem receber conversa
        const availableOperator = await this.findAvailableOperator();

        conversation = await this.prisma.conversation.create({
          data: {
            contactId: contact.id,
            serviceInstanceId: serviceInstance.id,
            operatorId: availableOperator?.id,
            status: ChatStatus.OPEN,
          },
        });

        // Atualizar timestamp do operador
        if (availableOperator) {
          await this.prisma.user.update({
            where: { id: availableOperator.id },
            data: {
              lastConversationAssignedAt: new Date(),
            },
          });

          this.logger.log(
            `Conversa Evolution atribuída automaticamente ao operador: ${availableOperator.name}`,
          );
        } else {
          this.logger.warn('Nenhum operador online disponível. Conversa entrará na fila.');
        }
      }

    // Criar mensagem
    const newMessage = await this.messagesService.receiveInbound({
      conversationId: conversation.id,
      content: messageText,
      externalId: data.key?.id,
    });

    // Notificar via WebSocket
    this.logger.log(`Emitindo mensagem via WebSocket`, {
      conversationId: conversation.id,
      messageId: newMessage.id,
      content: messageText.substring(0, 50),
    });
    this.chatGateway.emitNewMessage(conversation.id, newMessage);

    this.logger.log(`Mensagem Evolution processada com sucesso: ${data.key?.id}`);
  }

  private async processEvolutionMessageUpdate(
    payload: EvolutionWebhookDto,
  ): Promise<void> {
    const { data } = payload;

    if (!data.key?.id || !data.status) {
      return;
    }

    const message = await this.prisma.message.findFirst({
      where: { externalId: data.key.id },
    });

    if (message) {
      await this.messagesService.updateStatus(message.id, data.status);
      this.logger.log(`Status Evolution atualizado: ${data.key.id} -> ${data.status}`);
    }
  }

  private async findServiceInstanceByPhoneId(phoneId: string) {
    const instances = await this.prisma.serviceInstance.findMany({
      where: {
        provider: 'OFFICIAL_META',
        isActive: true,
      },
    });

    return instances.find((instance) => {
      const credentials = instance.credentials as any;
      return credentials.phoneId === phoneId;
    });
  }

  private async findServiceInstanceByEvolutionName(instanceName: string) {
    const instances = await this.prisma.serviceInstance.findMany({
      where: {
        provider: 'EVOLUTION_API',
        isActive: true,
      },
    });

    return instances.find((instance) => {
      const credentials = instance.credentials as any;
      return credentials.instanceName === instanceName;
    });
  }

  private extractMetaMessageText(message: any): string | null {
    if (message.type === 'text' && message.text?.body) {
      return message.text.body;
    }
    // TODO: Suportar outros tipos (imagem, áudio, vídeo, documento)
    return null;
  }

  private extractEvolutionMessageText(data: any): string | null {
    if (data.message?.conversation) {
      return data.message.conversation;
    }
    if (data.message?.extendedTextMessage?.text) {
      return data.message.extendedTextMessage.text;
    }
    // TODO: Suportar outros tipos de mídia
    return null;
  }

  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+') && cleaned.length >= 10) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  private async findAvailableOperator() {
    // Busca operadores online, ordenados por:
    // 1. Que nunca receberam conversa (lastConversationAssignedAt = null)
    // 2. Que receberam conversa há mais tempo (mais antigo primeiro)
    const operators = await this.prisma.user.findMany({
      where: {
        isOnline: true,
        isActive: true,
        role: { in: ['OPERATOR', 'SUPERVISOR'] },
      },
      orderBy: [
        { lastConversationAssignedAt: 'asc' }, // null vem primeiro (nunca recebeu)
      ],
      take: 1,
    });

    return operators[0] || null;
  }
}

