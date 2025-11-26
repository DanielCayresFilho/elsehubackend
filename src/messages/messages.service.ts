import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { Message, MessageDirection, MessageVia, ChatStatus } from '@prisma/client';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { ChatGateway } from '../websockets/chat.gateway';
import { StorageService } from '../storage/storage.service';

type SupportedMediaType = 'IMAGE' | 'AUDIO' | 'DOCUMENT';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly storageService: StorageService,
  ) {}

  async send(
    userId: string,
    payload: SendMessageDto,
  ): Promise<MessageResponseDto> {
    this.logger.log(`Tentando enviar mensagem`, {
      userId,
      conversationId: payload.conversationId,
      contentLength: payload.content?.length || 0,
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: payload.conversationId },
      include: {
        contact: true,
        serviceInstance: true,
      },
    });

    if (!conversation) {
      this.logger.error(`Conversa não encontrada: ${payload.conversationId}`);
      throw new NotFoundException('Conversa não encontrada');
    }

    this.logger.log(`Conversa encontrada`, {
      conversationId: conversation.id,
      status: conversation.status,
      serviceInstanceId: conversation.serviceInstanceId,
      serviceInstanceName: conversation.serviceInstance?.name,
      serviceInstanceActive: conversation.serviceInstance?.isActive,
      provider: conversation.serviceInstance?.provider,
    });

    if (conversation.status !== ChatStatus.OPEN) {
      this.logger.warn(`Tentativa de enviar mensagem para conversa fechada`, {
        conversationId: conversation.id,
        status: conversation.status,
      });
      throw new BadRequestException('Não é possível enviar mensagem para conversa fechada');
    }

    if (!conversation.serviceInstance) {
      this.logger.error(`Conversa sem instância de serviço vinculada`, {
        conversationId: conversation.id,
        serviceInstanceId: conversation.serviceInstanceId,
      });
      throw new BadRequestException('Conversa não possui instância de serviço vinculada');
    }

    if (!conversation.serviceInstance.isActive) {
      this.logger.warn(`Tentativa de enviar mensagem via instância inativa`, {
        conversationId: conversation.id,
        serviceInstanceId: conversation.serviceInstance.id,
        serviceInstanceName: conversation.serviceInstance.name,
      });
      throw new BadRequestException('Instância de serviço inativa');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        senderId: userId,
        content: payload.content,
        direction: MessageDirection.OUTBOUND,
        via: payload.via ?? MessageVia.CHAT_MANUAL,
        status: 'pending', // Será atualizado após envio real
      },
      include: {
        sender: true,
      },
    });

    // Enviar mensagem via provedor (Evolution API ou Meta)
    try {
      if (conversation.serviceInstance.provider === 'EVOLUTION_API') {
        await this.sendViaEvolutionAPI(conversation, message);
      } else if (conversation.serviceInstance.provider === 'OFFICIAL_META') {
        await this.sendViaMetaAPI(conversation, message);
      } else {
        throw new BadRequestException('Provedor não suportado');
      }
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem: ${error.message}`, error);
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'failed',
        },
      });
      throw new BadRequestException(`Falha ao enviar mensagem: ${error.message}`);
    }

    // Buscar mensagem atualizada para retornar
    const updatedMessage = await this.prisma.message.findUnique({
      where: { id: message.id },
      include: {
        sender: true,
      },
    });

    const response = this.toResponse(updatedMessage!);

    // Emitir via WebSocket para atualizar o frontend em tempo real
    this.chatGateway.emitNewMessage(payload.conversationId, response);

    return response;
  }

  async receiveInbound(data: {
    conversationId: string;
    content?: string;
    externalId?: string;
    mediaType?: SupportedMediaType | null;
    mediaUrl?: string | null;
    mediaMimeType?: string | null;
    mediaFileName?: string | null;
    mediaCaption?: string | null;
    mediaSize?: number | null;
    mediaStoragePath?: string | null;
  }): Promise<MessageResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const normalizedContent =
      data.content && data.content.trim().length > 0
        ? data.content
        : this.getDefaultContentForMedia(data.mediaType);

    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: null, // Cliente não tem userId
        content: normalizedContent,
        mediaType: data.mediaType ?? null,
        mediaUrl: data.mediaUrl ?? null,
        mediaMimeType: data.mediaMimeType ?? null,
        mediaFileName: data.mediaFileName ?? null,
        mediaCaption: data.mediaCaption ?? null,
        mediaSize: data.mediaSize ?? null,
        mediaStoragePath: data.mediaStoragePath ?? null,
        direction: MessageDirection.INBOUND,
        via: MessageVia.INBOUND,
        externalId: data.externalId ?? null,
        status: 'received',
      },
    });

    return this.toResponse(message);
  }

  async findByConversation(conversationId: string, query: ListMessagesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        include: {
          sender: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      data: data.map((message) => this.toResponse(message)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string): Promise<MessageResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        sender: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    return this.toResponse(message);
  }

  async updateStatus(messageId: string, status: string, externalId?: string): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        status,
        ...(externalId && { externalId }),
      },
    });
  }

  async downloadMedia(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            serviceInstance: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Mídia não encontrada para esta mensagem');
    }

    if (message.mediaStoragePath) {
      try {
        const absolutePath =
          this.storageService.resolveRelativePath(message.mediaStoragePath);
        const stream = createReadStream(absolutePath);

        return {
          stream,
          mimeType: message.mediaMimeType ?? 'application/octet-stream',
          fileName: message.mediaFileName ?? `${message.mediaType ?? 'media'}-${message.id}`,
          contentLength: message.mediaSize ?? undefined,
        };
      } catch (error: any) {
        this.logger.warn('Falha ao ler mídia local, tentando fallback remoto', {
          error: error.message,
          messageId,
        });
        await this.storageService.deleteFile(message.mediaStoragePath);
        await this.prisma.message.update({
          where: { id: message.id },
          data: { mediaStoragePath: null },
        });
      }
    }

    if (!message.mediaUrl) {
      throw new NotFoundException('Mídia não disponível');
    }

    if (!message.conversation || !message.conversation.serviceInstance) {
      throw new NotFoundException('Instância da conversa não encontrada para a mídia solicitada');
    }

    if (message.conversation.serviceInstance.provider !== 'EVOLUTION_API') {
      throw new BadRequestException('Download de mídia ainda não suportado para este provedor');
    }

    const credentials = message.conversation.serviceInstance.credentials as Record<string, any>;
    const absoluteUrl = this.buildAbsoluteMediaUrl(message.mediaUrl, credentials?.serverUrl);

    if (!absoluteUrl) {
      throw new BadRequestException('URL da mídia não pôde ser resolvida');
    }

    try {
      const response = await axios.get(absoluteUrl, {
        responseType: 'stream',
        headers: {
          apikey: credentials?.apiToken,
        },
      });

      return {
        stream: response.data,
        mimeType: message.mediaMimeType ?? 'application/octet-stream',
        fileName: message.mediaFileName ?? `${message.mediaType ?? 'media'}-${message.id}`,
        contentLength: response.headers['content-length'],
      };
    } catch (error: any) {
      this.logger.error('Erro ao baixar mídia da Evolution API', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new BadRequestException(
        `Não foi possível baixar a mídia: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  private async sendViaEvolutionAPI(conversation: any, message: Message): Promise<void> {
    const credentials = conversation.serviceInstance.credentials as Record<string, any>;
    const { serverUrl, apiToken, instanceName } = credentials;

    if (!serverUrl || !apiToken || !instanceName) {
      throw new BadRequestException('Credenciais da Evolution API incompletas');
    }

    const phone = this.normalizePhoneNumber(conversation.contact.phone);
    
    const sendUrl = `${serverUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

    // Verificar se a instância existe e está conectada (opcional, apenas para diagnóstico)
    try {
      const checkUrl = `${serverUrl.replace(/\/$/, '')}/instance/connect/${instanceName}`;
      const checkResponse = await axios.get(checkUrl, {
        headers: { apikey: apiToken },
      });
      
      const instanceState = checkResponse.data?.instance?.state;
      this.logger.log(`Status da instância verificado: ${instanceState}`, {
        instanceName,
        state: instanceState,
      });
      
      if (instanceState !== 'open') {
        this.logger.warn(`Instância '${instanceName}' não está conectada (state: ${instanceState})`, {
          instanceName,
          state: instanceState,
        });
      }
    } catch (checkError: any) {
      // Não bloquear o envio se a verificação falhar, apenas logar
      this.logger.warn(`Não foi possível verificar o status da instância '${instanceName}'`, {
        error: checkError.message,
        instanceName,
      });
    }

    this.logger.log(`Enviando mensagem via Evolution API`, {
      url: sendUrl,
      phone,
      instanceName,
      serverUrl,
      messageLength: message.content?.length || 0,
      conversationId: conversation.id,
      contactPhone: conversation.contact.phone,
    });

    // Validar se o telefone está no formato correto (apenas números, sem +)
    if (!/^\d+$/.test(phone)) {
      this.logger.error(`Formato de telefone inválido: ${phone}`, {
        original: conversation.contact.phone,
        normalized: phone,
      });
      throw new BadRequestException(`Formato de telefone inválido: ${phone}. Deve conter apenas números.`);
    }

    // Validar se o telefone tem pelo menos 10 dígitos (formato mínimo internacional)
    if (phone.length < 10) {
      this.logger.error(`Telefone muito curto: ${phone}`, {
        original: conversation.contact.phone,
        normalized: phone,
        length: phone.length,
      });
      throw new BadRequestException(`Telefone muito curto: ${phone}. Deve ter pelo menos 10 dígitos.`);
    }

    const payload = {
      number: phone,
      text: message.content,
    };

    this.logger.debug(`Payload de envio: ${JSON.stringify(payload)}`);

    try {
      this.logger.log(`Fazendo requisição para Evolution API`, {
        url: sendUrl,
        method: 'POST',
        hasApiKey: !!apiToken,
        apiKeyLength: apiToken?.length || 0,
        payload: JSON.stringify(payload),
      });

      const response = await axios.post(
        sendUrl,
        payload,
        {
          headers: {
            apikey: apiToken,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 segundos
        },
      );

      this.logger.log(`Resposta da Evolution API: ${JSON.stringify(response.data)}`, {
        status: response.status,
        statusText: response.statusText,
      });

      // A Evolution API retorna o ID da mensagem em key.id
      const externalId = response.data?.key?.id || response.data?.id || `evol_${Date.now()}`;
      // Status pode ser PENDING, SENT, DELIVERED, READ, etc.
      const status = response.data?.status?.toLowerCase() || 'sent';

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status,
          externalId,
        },
      });

      this.logger.log(`Mensagem enviada com sucesso: ${externalId}`, {
        status,
        externalId,
      });
    } catch (error: any) {
      const errorDetails = {
        error: error.message,
        errorStack: error.stack,
        url: sendUrl,
        payload: JSON.stringify(payload),
        phoneOriginal: conversation.contact.phone,
        phoneNormalized: phone,
        instanceName,
        serverUrl,
        hasApiToken: !!apiToken,
        apiTokenLength: apiToken?.length || 0,
        responseData: error.response?.data ? JSON.stringify(error.response.data) : null,
        responseStatus: error.response?.status,
        responseStatusText: error.response?.statusText,
        responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : null,
        requestConfig: {
          url: sendUrl,
          method: 'POST',
          headers: {
            apikey: apiToken ? `${apiToken.substring(0, 10)}...` : 'MISSING',
            'Content-Type': 'application/json',
          },
        },
      };

      this.logger.error('Erro ao enviar mensagem na Evolution API', errorDetails);

      // Se for 404, pode ser que o endpoint esteja errado ou a instância não existe
      if (error.response?.status === 404) {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Endpoint não encontrado';
        this.logger.error(`Erro 404 - Verifique se a instância '${instanceName}' existe na Evolution API`, {
          instanceName,
          serverUrl,
          endpoint: sendUrl,
        });
        throw new BadRequestException(
          `Instância '${instanceName}' não encontrada na Evolution API ou endpoint incorreto. Verifique se a instância existe e está conectada. Erro: ${errorMessage}`,
        );
      }

      // Se for 400, pode ser formato incorreto do telefone ou payload
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
        this.logger.error(`Erro 400 - Bad Request da Evolution API`, {
          ...errorDetails,
          evolutionError: errorMessage,
        });
        throw new BadRequestException(
          `Falha ao enviar mensagem na Evolution API: ${errorMessage}. Verifique o formato do telefone (original: ${conversation.contact.phone}, normalizado: ${phone}) e se a instância está conectada.`,
        );
      }

      throw new BadRequestException(
        `Falha ao enviar mensagem na Evolution API: ${error.response?.data?.message || error.response?.data?.error || error.message}`,
      );
    }
  }

  private toResponse(message: Message & { sender?: { name: string } | null }): MessageResponseDto {
    const publicUrl = message.mediaStoragePath
      ? `/media/${message.mediaStoragePath.replace(/\\/g, '/').replace(/^\//, '')}`
      : null;

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender?.name ?? null,
      content: message.content,
      hasMedia: Boolean(message.mediaUrl || message.mediaStoragePath),
      mediaType: message.mediaType,
      mediaFileName: message.mediaFileName,
      mediaMimeType: message.mediaMimeType,
      mediaSize: message.mediaSize,
      mediaCaption: message.mediaCaption,
      mediaStoragePath: message.mediaStoragePath,
      mediaPublicUrl: publicUrl,
      mediaDownloadPath:
        publicUrl ?? (message.mediaUrl ? `/api/messages/${message.id}/media` : null),
      direction: message.direction,
      via: message.via,
      externalId: message.externalId,
      status: message.status,
      createdAt: message.createdAt,
    };
  }

  private getDefaultContentForMedia(mediaType?: SupportedMediaType | null): string {
    switch (mediaType) {
      case 'IMAGE':
        return '[Imagem recebida]';
      case 'AUDIO':
        return '[Áudio recebido]';
      case 'DOCUMENT':
        return '[Documento recebido]';
      default:
        return '[Mensagem recebida]';
    }
  }

  private buildAbsoluteMediaUrl(url: string, serverUrl?: string): string | null {
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

  private normalizePhoneNumber(rawPhone: string | null | undefined): string {
    if (!rawPhone) {
      throw new BadRequestException('Contato sem telefone válido');
    }

    let phone = rawPhone.replace(/[^\d+]/g, '');
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }

    if (!phone) {
      throw new BadRequestException('Telefone do contato inválido');
    }

    return phone;
  }

  private getMetaGraphConfig(credentials: Record<string, any>) {
    const version =
      credentials.apiVersion ||
      process.env.META_GRAPH_API_VERSION ||
      'v18.0';
    const baseUrl =
      credentials.graphApiUrl ||
      process.env.META_GRAPH_API_BASE_URL ||
      'https://graph.facebook.com';

    return {
      version: version.replace(/^\//, '').replace(/\/$/, ''),
      baseUrl: baseUrl.replace(/\/$/, ''),
    };
  }

  private async sendViaMetaAPI(conversation: any, message: Message): Promise<void> {
    const credentials = conversation.serviceInstance.credentials as Record<string, any>;
    const { phoneId, accessToken } = credentials;

    if (!phoneId || !accessToken) {
      throw new BadRequestException('Credenciais da Meta incompletas');
    }

    const phone = this.normalizePhoneNumber(conversation.contact.phone);
    const { version, baseUrl } = this.getMetaGraphConfig(credentials);
    const sendUrl = `${baseUrl}/${version}/${phoneId}/messages`;

    this.logger.log(`Enviando mensagem via Meta WhatsApp API`, {
      phoneId,
      sendUrl,
      conversationId: conversation.id,
      messageLength: message.content?.length || 0,
    });

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: message.content,
      },
    };

    try {
      const response = await axios.post(sendUrl, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const externalId =
        response.data?.messages?.[0]?.id ||
        response.data?.message_id ||
        `meta_${Date.now()}`;

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'sent',
          externalId,
        },
      });

      this.logger.log(`Mensagem enviada via Meta API com sucesso`, {
        externalId,
        phoneId,
      });
    } catch (error: any) {
      this.logger.error('Erro ao enviar mensagem na Meta API', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        sendUrl,
        payload,
      });

      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message;

      throw new BadRequestException(
        `Falha ao enviar mensagem na Meta API: ${errorMessage}`,
      );
    }
  }
}

