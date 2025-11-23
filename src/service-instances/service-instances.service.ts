import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ServiceInstance } from '@prisma/client';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceInstanceDto } from './dto/create-service-instance.dto';
import { UpdateServiceInstanceDto } from './dto/update-service-instance.dto';
import { ServiceInstanceResponseDto } from './dto/service-instance-response.dto';

@Injectable()
export class ServiceInstancesService {
  private readonly logger = new Logger(ServiceInstancesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getQrCode(id: string): Promise<{ base64?: string; pairingCode?: string; message?: string }> {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    if (instance.provider !== 'EVOLUTION_API') {
      throw new BadRequestException('QR Code disponível apenas para Evolution API');
    }

    const credentials = instance.credentials as Record<string, any>;
    const { serverUrl, apiToken, instanceName } = credentials;

    if (!serverUrl || !apiToken || !instanceName) {
      throw new BadRequestException('Credenciais inválidas para conectar');
    }

    try {
      // Primeiro, tenta conectar a instância
      const connectUrl = `${serverUrl}/instance/connect/${instanceName}`;
      this.logger.log(`Fetching QR Code from: ${connectUrl}`);

      const response = await axios.get(connectUrl, {
        headers: {
          apikey: apiToken,
        },
      });

      // A Evolution retorna: { instance: { ... }, base64: "..." } ou { code: "..." }
      if (response.data?.base64) {
        return { base64: response.data.base64 };
      } else if (response.data?.code) {
        return { pairingCode: response.data.code };
      } else if (response.data?.instance?.state === 'open') {
         return { message: 'Instância já conectada' };
      }

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao buscar QR Code na Evolution API', error);
      throw new BadRequestException('Falha ao comunicar com a Evolution API: ' + (error.response?.data?.message || error.message));
    }
  }

  async create(
    payload: CreateServiceInstanceDto,
  ): Promise<ServiceInstanceResponseDto> {
    this.validateCredentials(payload.provider, payload.credentials);

    // Se for Evolution API, criar a instância na Evolution primeiro
    if (payload.provider === 'EVOLUTION_API') {
      await this.createEvolutionInstance(payload.credentials);
      // Configurar webhook automaticamente após criar a instância
      await this.configureEvolutionWebhook(payload.credentials);
    }

    const instance = await this.prisma.serviceInstance.create({
      data: {
        name: payload.name.trim(),
        provider: payload.provider,
        credentials: payload.credentials,
      },
    });

    return this.toResponse(instance);
  }

  private async createEvolutionInstance(credentials: Record<string, any>): Promise<void> {
    const { serverUrl, apiToken, instanceName } = credentials;

    if (!serverUrl || !apiToken || !instanceName) {
      throw new BadRequestException(
        'Credenciais da Evolution API incompletas. Necessário: instanceName, apiToken, serverUrl',
      );
    }

    try {
      // Endpoint da Evolution API para criar instância
      // A Evolution API v2 usa POST /instance/create com instanceName no body
      const createUrl = `${serverUrl.replace(/\/$/, '')}/instance/create`;
      this.logger.log(`Criando instância na Evolution API: ${createUrl}`);

      const response = await axios.post(
        createUrl,
        {
          instanceName: instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        },
        {
          headers: {
            apikey: apiToken,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Instância criada na Evolution API: ${instanceName}`, {
        status: response.status,
        data: response.data,
      });
    } catch (error: any) {
      this.logger.error('Erro ao criar instância na Evolution API', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });

      // Se a instância já existe, não é um erro crítico (pode continuar)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || '';
      if (
        error.response?.status === 400 &&
        (errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('já existe') ||
          errorMessage.toLowerCase().includes('duplicate'))
      ) {
        this.logger.warn(`Instância ${instanceName} já existe na Evolution API, continuando...`);
        return;
      }

      // Se for erro 401, credenciais inválidas
      if (error.response?.status === 401) {
        throw new BadRequestException(
          'Credenciais inválidas da Evolution API. Verifique o apiToken e a URL do servidor.',
        );
      }

      throw new BadRequestException(
        `Falha ao criar instância na Evolution API: ${errorMessage || error.message}`,
      );
    }
  }

  private async configureEvolutionWebhook(credentials: Record<string, any>): Promise<void> {
    const { serverUrl, apiToken, instanceName } = credentials;

    // URL do webhook (deve ser configurável via variável de ambiente)
    const webhookUrl = process.env.WEBHOOK_URL || process.env.APP_URL 
      ? `${process.env.APP_URL}/api/webhooks/evolution`
      : null;

    if (!webhookUrl) {
      this.logger.warn('WEBHOOK_URL ou APP_URL não configurado. Webhook não será configurado automaticamente.');
      this.logger.warn('Configure manualmente na Evolution API ou defina a variável WEBHOOK_URL/APP_URL');
      return;
    }

    try {
      const webhookUrlEndpoint = `${serverUrl.replace(/\/$/, '')}/webhook/set/${instanceName}`;
      this.logger.log(`Configurando webhook da Evolution API: ${webhookUrlEndpoint}`);

      const response = await axios.post(
        webhookUrlEndpoint,
        {
          webhook: {
            url: webhookUrl,
            enabled: true,
            webhook_by_events: true,
            webhook_base64: false,
            events: [
              'MESSAGES_UPSERT',    // Mensagens recebidas/enviadas
              'MESSAGES_UPDATE',     // Atualização de status (sent, delivered, read)
              'CONNECTION_UPDATE',   // Atualização de conexão
            ],
          },
        },
        {
          headers: {
            apikey: apiToken,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Webhook configurado com sucesso para instância: ${instanceName}`, {
        url: webhookUrl,
        status: response.status,
      });
    } catch (error: any) {
      this.logger.error('Erro ao configurar webhook na Evolution API', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      // Não lançar erro, apenas logar - o webhook pode ser configurado manualmente depois
      this.logger.warn('Webhook não configurado automaticamente. Configure manualmente na Evolution API.');
    }
  }

  async findAll() {
    const instances = await this.prisma.serviceInstance.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return instances.map((instance) => this.toResponse(instance));
  }

  async findOne(id: string): Promise<ServiceInstanceResponseDto> {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    return this.toResponse(instance);
  }

  async update(
    id: string,
    payload: UpdateServiceInstanceDto,
  ): Promise<ServiceInstanceResponseDto> {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    if (payload.provider && payload.credentials) {
      this.validateCredentials(payload.provider, payload.credentials);
    } else if (payload.credentials) {
      this.validateCredentials(instance.provider, payload.credentials);
    }

    const updated = await this.prisma.serviceInstance.update({
      where: { id },
      data: {
        name: payload.name?.trim(),
        provider: payload.provider,
        credentials: payload.credentials,
        isActive: payload.isActive,
      },
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id },
      include: {
        conversations: true,
        campaigns: true,
      },
    });

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    if (instance.conversations.length > 0 || instance.campaigns.length > 0) {
      throw new BadRequestException(
        'Não é possível remover uma instância com conversas ou campanhas associadas',
      );
    }

    await this.prisma.serviceInstance.delete({ where: { id } });
  }

  private validateCredentials(
    provider: string,
    credentials: Record<string, any>,
  ): void {
    if (provider === 'OFFICIAL_META') {
      if (
        !credentials.wabaId ||
        !credentials.phoneId ||
        !credentials.accessToken
      ) {
        throw new BadRequestException(
          'Credenciais da Meta incompletas. Necessário: wabaId, phoneId, accessToken',
        );
      }
    } else if (provider === 'EVOLUTION_API') {
      if (
        !credentials.instanceName ||
        !credentials.apiToken ||
        !credentials.serverUrl
      ) {
        throw new BadRequestException(
          'Credenciais da Evolution API incompletas. Necessário: instanceName, apiToken, serverUrl',
        );
      }
    }
  }

  private toResponse(instance: ServiceInstance): ServiceInstanceResponseDto {
    return {
      id: instance.id,
      name: instance.name,
      provider: instance.provider,
      credentials: instance.credentials as Record<string, any>,
      isActive: instance.isActive,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    };
  }
}

