import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { ChatStatus, MessageDirection } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatGateway } from '../websockets/chat.gateway';
import { StorageService } from '../storage/storage.service';
import { MetaWebhookDto } from './dto/meta-webhook.dto';
import { EvolutionWebhookDto } from './dto/evolution-webhook.dto';

type EvolutionSupportedMediaType = 'IMAGE' | 'AUDIO' | 'DOCUMENT';

interface EvolutionMediaPayload {
  type: EvolutionSupportedMediaType;
  url: string | null;
  mimeType: string | null;
  fileName: string | null;
  caption: string | null;
  size: number | null;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly chatGateway: ChatGateway,
    private readonly storageService: StorageService,
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

      let isNewConversation = false;
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

        isNewConversation = true;

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

      // Se for uma nova conversa, notificar o frontend com os dados completos
      if (isNewConversation) {
        const fullConversation = await this.conversationsService.findOne(conversation.id);
        this.chatGateway.emitNewConversation(fullConversation);
        this.logger.log(`Nova conversa criada e notificada: ${conversation.id}`, {
          serviceInstanceId: fullConversation.serviceInstanceId,
          serviceInstanceName: fullConversation.serviceInstanceName,
        });
      }

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
      messageType: data.messageType,
      messageKeys: data.message ? Object.keys(data.message) : [],
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

    // Verificar se é mensagem de grupo (termina com @g.us)
    if (data.key?.remoteJid?.endsWith('@g.us')) {
      this.logger.debug('Mensagem Evolution de grupo ignorada (não suportado)');
      return;
    }

    // Remover qualquer sufixo após @ (ex: @s.whatsapp.net, @lid, @g.us, etc)
    const rawPhone = data.key?.remoteJid?.split('@')[0] || '';
    const contactPhone = this.normalizePhone(rawPhone);
    
    this.logger.log(`Telefone normalizado: ${contactPhone}`, {
      original: data.key?.remoteJid,
      rawPhone,
      normalized: contactPhone,
      instance,
    });
    
    const mediaPayload = this.extractEvolutionMediaPayload(data, serviceInstance);
    const messageText = this.extractEvolutionMessageText(data);

    this.logger.log(
      `Conteúdo extraído da mensagem: ${
        messageText ? `"${messageText.substring(0, 50)}"` : mediaPayload ? '[MÍDIA]' : 'NENHUM'
      }`,
      {
        hasMessage: !!data.message,
        messageKeys: data.message ? Object.keys(data.message) : [],
        mediaType: mediaPayload?.type ?? null,
      },
    );

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

      let isNewConversation = false;
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

        isNewConversation = true;

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

    const supportsContent = Boolean(messageText) || Boolean(mediaPayload);
    const hasSticker = Boolean(data.message?.stickerMessage);
    const hasVideo = Boolean(data.message?.videoMessage);

    if (!supportsContent) {
      if (hasSticker || hasVideo) {
        const unsupportedType = hasSticker ? 'STICKER' : 'VIDEO';
        await this.createUnsupportedMediaNotice(conversation.id, unsupportedType);
        this.logger.warn(`Mensagem Evolution de ${unsupportedType} recebida e registrada como aviso.`);
      } else {
        this.logger.warn('Mensagem Evolution sem texto e sem mídia suportada, pulando...', {
          messageKeys: data.message ? Object.keys(data.message) : [],
        });
      }
      return;
    }

    let storedMediaMetadata: { storagePath: string | null; size: number | null } | null =
      null;

    if (mediaPayload) {
      storedMediaMetadata = await this.persistEvolutionMedia(
        mediaPayload,
        serviceInstance,
        conversation.id,
        data.key?.id,
      );
    }

    // Criar mensagem
    const newMessage = await this.messagesService.receiveInbound({
      conversationId: conversation.id,
      content: messageText ?? mediaPayload?.caption ?? undefined,
      externalId: data.key?.id,
      mediaType: mediaPayload?.type ?? null,
      mediaUrl: mediaPayload?.url ?? null,
      mediaMimeType: mediaPayload?.mimeType ?? null,
      mediaFileName: mediaPayload?.fileName ?? null,
      mediaCaption: mediaPayload?.caption ?? null,
      mediaSize: storedMediaMetadata?.size ?? mediaPayload?.size ?? null,
      mediaStoragePath: storedMediaMetadata?.storagePath ?? null,
    });

    // Notificar via WebSocket
    this.logger.log(`Emitindo mensagem via WebSocket`, {
      conversationId: conversation.id,
      messageId: newMessage.id,
      content: (messageText ?? mediaPayload?.caption ?? '[conteúdo indisponível]').substring(0, 50),
    });
    this.chatGateway.emitNewMessage(conversation.id, newMessage);

    // Se for uma nova conversa, notificar o frontend com os dados completos
    if (isNewConversation) {
      const fullConversation = await this.conversationsService.findOne(conversation.id);
      this.chatGateway.emitNewConversation(fullConversation);
      this.logger.log(`Nova conversa Evolution criada e notificada: ${conversation.id}`, {
        serviceInstanceId: fullConversation.serviceInstanceId,
        serviceInstanceName: fullConversation.serviceInstanceName,
      });
    }

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

  private extractEvolutionMessageText(data: EvolutionWebhookDto['data']): string | null {
    if (data.message?.conversation) {
      return data.message.conversation;
    }
    if (data.message?.extendedTextMessage?.text) {
      return data.message.extendedTextMessage.text;
    }
    // TODO: Suportar outros tipos de mídia
    return null;
  }

  private extractEvolutionMediaPayload(
    data: EvolutionWebhookDto['data'],
    serviceInstance: any,
  ): EvolutionMediaPayload | null {
    const credentials = (serviceInstance.credentials as Record<string, any>) || {};

    if (data.message?.imageMessage) {
      const image = data.message.imageMessage;
      return {
        type: 'IMAGE',
        url: this.buildEvolutionMediaUrl(image.url, credentials.serverUrl),
        mimeType: image.mimetype || image.mimeType || 'image/jpeg',
        fileName: image.fileName || `imagem-${data.key?.id ?? Date.now()}.jpg`,
        caption: image.caption || image.captionMessage || null,
        size: this.normalizeMediaSize(image.fileLength ?? image.fileSize),
      };
    }

    if (data.message?.audioMessage) {
      const audio = data.message.audioMessage;
      return {
        type: 'AUDIO',
        url: this.buildEvolutionMediaUrl(audio.url, credentials.serverUrl),
        mimeType: audio.mimetype || audio.mimeType || 'audio/mpeg',
        fileName: audio.fileName || `audio-${data.key?.id ?? Date.now()}.mp3`,
        caption: null,
        size: this.normalizeMediaSize(audio.fileLength ?? audio.fileSize),
      };
    }

    if (data.message?.documentMessage) {
      const document = data.message.documentMessage;
      return {
        type: 'DOCUMENT',
        url: this.buildEvolutionMediaUrl(document.url, credentials.serverUrl),
        mimeType: document.mimetype || document.mimeType || 'application/octet-stream',
        fileName: document.fileName || document.title || `documento-${data.key?.id ?? Date.now()}`,
        caption: document.caption || null,
        size: this.normalizeMediaSize(document.fileLength ?? document.fileSize),
      };
    }

    return null;
  }

  private buildEvolutionMediaUrl(url: string, serverUrl?: string): string | null {
    if (!url) {
      return null;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (!serverUrl) {
      return null;
    }

    return `${serverUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  private async createUnsupportedMediaNotice(
    conversationId: string,
    type: 'STICKER' | 'VIDEO',
  ): Promise<void> {
    const content =
      type === 'STICKER'
        ? 'Recebemos um sticker, mas esse tipo de mídia ainda não é suportado.'
        : 'Recebemos um vídeo, mas esse tipo de mídia ainda não é suportado.';

    const message = await this.messagesService.receiveInbound({
      conversationId,
      content,
    });

    this.chatGateway.emitNewMessage(conversationId, message);
  }

  private async persistEvolutionMedia(
    mediaPayload: EvolutionMediaPayload,
    serviceInstance: any,
    conversationId: string,
    messageId?: string,
  ): Promise<{ storagePath: string; size: number } | null> {
    const credentials = (serviceInstance.credentials as Record<string, any>) || {};

    try {
      let buffer: Buffer | null = null;
      let contentType: string | null = null;

      const urlResult = await this.downloadMediaFromUrl(mediaPayload, credentials);
      if (urlResult) {
        buffer = urlResult.buffer;
        contentType = urlResult.contentType;

        if (
          !this.isValidMediaContent(
            mediaPayload.type,
            contentType ?? mediaPayload.mimeType ?? '',
            buffer,
          )
        ) {
          this.logger.warn('Mídia recebida via URL inválida, tentando Base64', {
            requestedType: mediaPayload.type,
            contentType,
          });
          buffer = null;
          contentType = null;
        }
      }

      if (!buffer && messageId) {
        const base64Result = await this.downloadMediaFromBase64(
          mediaPayload,
          credentials,
          messageId,
        );
        if (base64Result) {
          buffer = base64Result.buffer;
          contentType = base64Result.contentType;
        }
      }

      if (!buffer) {
        throw new BadRequestException('Falha ao baixar mídia da Evolution');
      }

      if (
        !this.isValidMediaContent(
          mediaPayload.type,
          contentType ?? mediaPayload.mimeType ?? '',
          buffer,
        )
      ) {
        const preview = buffer.toString('utf8', 0, 200);
        this.logger.error('Conteúdo inválido ao baixar mídia da Evolution', {
          requestedType: mediaPayload.type,
          contentType,
          preview,
        });
        throw new BadRequestException('Falha ao baixar mídia da Evolution (tipo inválido)');
      }

      const savedFile = await this.storageService.saveFile({
        buffer,
        originalName:
          mediaPayload.fileName ??
          `${mediaPayload.type?.toLowerCase() ?? 'media'}-${conversationId}`,
        subdirectory: `messages/${conversationId}`,
      });

      return {
        storagePath: savedFile.relativeToBasePath,
        size: savedFile.size,
      };
    } catch (error: any) {
      this.logger.error('Erro ao baixar/salvar mídia localmente', {
        error: error.message,
        mediaType: mediaPayload.type,
      });
      return null;
    }
  }

  private async downloadMediaFromUrl(
    mediaPayload: EvolutionMediaPayload,
    credentials: Record<string, any>,
  ): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    if (!mediaPayload.url) {
      return null;
    }

    try {
      const response = await axios.get(mediaPayload.url, {
        responseType: 'arraybuffer',
        headers: credentials.apiToken ? { apikey: credentials.apiToken } : undefined,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const contentType =
        (response.headers['content-type'] as string | undefined)?.toLowerCase() ?? null;

      return {
        buffer: Buffer.from(response.data),
        contentType,
      };
    } catch (error: any) {
      this.logger.warn('Falha ao baixar mídia via URL da Evolution', {
        error: error.message,
        mediaType: mediaPayload.type,
      });
      return null;
    }
  }

  private async downloadMediaFromBase64(
    mediaPayload: EvolutionMediaPayload,
    credentials: Record<string, any>,
    messageId: string,
  ): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    const { serverUrl, apiToken, instanceName } = credentials;
    if (!serverUrl || !apiToken || !instanceName) {
      this.logger.warn(
        'Credenciais incompletas para download Base64 da Evolution',
        credentials,
      );
      return null;
    }

    const endpoint = `${serverUrl.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`;

    try {
      const response = await axios.post(
        endpoint,
        {
          message: {
            key: {
              id: messageId,
            },
          },
        },
        {
          headers: {
            apikey: apiToken,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const base64Payload =
        response.data?.base64 || response.data?.data || response.data?.result?.base64;
      const contentType =
        response.data?.mimetype ||
        response.data?.mimeType ||
        response.data?.type ||
        mediaPayload.mimeType ||
        null;

      if (!base64Payload || typeof base64Payload !== 'string') {
        this.logger.error('Resposta Base64 da Evolution sem campo base64', {
          status: response.status,
          dataKeys: Object.keys(response.data || {}),
        });
        return null;
      }

      const { buffer, mimeTypeFromData } = this.decodeBase64Payload(base64Payload);

      return {
        buffer,
        contentType: mimeTypeFromData || contentType,
      };
    } catch (error: any) {
      this.logger.error('Erro ao obter mídia em Base64 da Evolution', {
        error: error.message,
        mediaType: mediaPayload.type,
      });
      return null;
    }
  }

  private decodeBase64Payload(base64Payload: string): {
    buffer: Buffer;
    mimeTypeFromData: string | null;
  } {
    const match = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/i.exec(base64Payload);

    if (match?.groups?.mime && match.groups.data) {
      return {
        buffer: Buffer.from(match.groups.data, 'base64'),
        mimeTypeFromData: match.groups.mime.toLowerCase(),
      };
    }

    return {
      buffer: Buffer.from(base64Payload, 'base64'),
      mimeTypeFromData: null,
    };
  }

  private isValidMediaContent(
    mediaType: EvolutionSupportedMediaType,
    contentType: string,
    buffer: Buffer,
  ): boolean {
    const normalizedType = contentType || '';

    if (
      normalizedType.includes('text/html') ||
      normalizedType.includes('application/json')
    ) {
      return false;
    }

    if (mediaType === 'IMAGE') {
      return (
        normalizedType.startsWith('image/') ||
        this.looksLikeImage(buffer)
      );
    }

    if (mediaType === 'AUDIO') {
      return (
        normalizedType.startsWith('audio/') ||
        this.looksLikeAudio(buffer)
      );
    }

    if (mediaType === 'DOCUMENT') {
      return (
        normalizedType.startsWith('application/') ||
        normalizedType.startsWith('text/plain') ||
        normalizedType === 'application/octet-stream'
      );
    }

    return false;
  }

  private looksLikeImage(buffer: Buffer): boolean {
    if (buffer.length < 4) {
      return false;
    }

    const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const png =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const gif =
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38;
    const webp =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    return jpeg || png || gif || webp;
  }

  private looksLikeAudio(buffer: Buffer): boolean {
    if (buffer.length < 4) {
      return false;
    }

    const id3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
    const mpegFrame =
      buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0; // MPEG frame sync
    const ogg =
      buffer[0] === 0x4f &&
      buffer[1] === 0x67 &&
      buffer[2] === 0x67 &&
      buffer[3] === 0x53;
    const riff =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WAVE';

    return id3 || mpegFrame || ogg || riff;
  }

  private normalizeMediaSize(value: any): number | null {
    const MAX_INT32 = 2_147_483_647;

    if (value === null || value === undefined) {
      return null;
    }

    let numericValue: number | null = null;

    if (typeof value === 'number') {
      numericValue = value;
    } else if (typeof value === 'string') {
      const parsed = Number(value);
      numericValue = Number.isFinite(parsed) ? parsed : null;
    } else if (typeof value === 'object') {
      const low = typeof value.low === 'number' ? value.low >>> 0 : 0;
      const high = typeof value.high === 'number' ? value.high >>> 0 : 0;
      const combined = high * 2 ** 32 + low;
      numericValue = Number.isFinite(combined) ? combined : null;
    }

    if (numericValue === null) {
      return null;
    }

    if (numericValue < 0) {
      numericValue = 0;
    }

    if (numericValue > MAX_INT32) {
      numericValue = MAX_INT32;
    }

    return Math.floor(numericValue);
  }

  private normalizePhone(phone: string): string {
    if (!phone) {
      return '';
    }
    
    // Remover qualquer sufixo após @ (caso ainda tenha)
    const withoutSuffix = phone.split('@')[0];
    
    // Manter apenas dígitos e +
    const cleaned = withoutSuffix.replace(/[^\d+]/g, '');
    
    // Se não começa com + e tem pelo menos 10 dígitos, adicionar +
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

