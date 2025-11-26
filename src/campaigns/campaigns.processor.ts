import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignStatus } from '@prisma/client';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service';

@Processor('campaigns')
export class CampaignsProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignsProcessor.name);
  private lastSentTimes: Map<string, number> = new Map();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { campaignId, campaignItemId } = job.data;

    try {
      // Buscar campanha e item
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          serviceInstance: true,
          template: true,
        },
      });

      if (!campaign) {
        this.logger.error(`Campanha ${campaignId} não encontrada`);
        return;
      }

      // Verificar se está pausada
      if (campaign.status === CampaignStatus.PAUSED) {
        this.logger.log(`Campanha ${campaignId} pausada, aguardando...`);
        await job.moveToDelayed(Date.now() + 30000); // Aguardar 30s
        return;
      }

      const item = await this.prisma.campaignItem.findUnique({
        where: { id: campaignItemId },
        include: {
          contact: true,
        },
      });

      if (!item) {
        this.logger.error(`Item ${campaignItemId} não encontrado`);
        return;
      }

      if (item.status !== 'PENDING') {
        this.logger.log(`Item ${campaignItemId} já foi processado`);
        return;
      }

      // Respeitar delay entre envios
      const lastSent = this.lastSentTimes.get(campaignId) || 0;
      const now = Date.now();
      const timeSinceLastSent = now - lastSent;
      const delayMs = campaign.delaySeconds * 1000;

      if (timeSinceLastSent < delayMs) {
        const waitTime = delayMs - timeSinceLastSent;
        this.logger.log(
          `Aguardando ${waitTime}ms antes de enviar próxima mensagem`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Preparar conteúdo da mensagem
      let messageContent = campaign.template?.body || 'Olá! Esta é uma mensagem da campanha.';
      
      // Substituir variáveis simples no template (ex: {{name}})
      if (campaign.template && item.contact.name) {
        messageContent = messageContent.replace(/\{\{name\}\}/g, item.contact.name);
        messageContent = messageContent.replace(/\{\{phone\}\}/g, item.contact.phone);
      }

      this.logger.log(
        `Enviando mensagem para ${item.contact.phone} (campanha: ${campaign.name})`,
      );

      // Enviar mensagem via provedor (Evolution API ou Meta)
      try {
        if (campaign.serviceInstance.provider === 'EVOLUTION_API') {
          await this.sendViaEvolutionAPI(campaign, item, messageContent);
        } else if (campaign.serviceInstance.provider === 'OFFICIAL_META') {
          await this.sendViaMetaAPI(campaign, item, messageContent);
        } else {
          throw new Error('Provedor não suportado');
        }

        // Marcar como enviado
        await this.prisma.campaignItem.update({
          where: { id: campaignItemId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        this.logger.log(`Mensagem enviada com sucesso: ${item.contact.phone}`);
      } catch (error: any) {
        this.logger.error(
          `Falha ao enviar mensagem para ${item.contact.phone}: ${error.message}`,
          error.stack,
        );

        // Marcar como falha
        await this.prisma.campaignItem.update({
          where: { id: campaignItemId },
          data: {
            status: 'FAILED',
            errorMessage: error.message || 'Erro ao enviar mensagem',
          },
        });
      }

      // Atualizar tempo do último envio
      this.lastSentTimes.set(campaignId, Date.now());

      // Verificar se a campanha terminou
      await this.checkCampaignCompletion(campaignId);
    } catch (error) {
      this.logger.error(`Erro ao processar job da campanha: ${error.message}`);
      
      // Atualizar item como falha
      await this.prisma.campaignItem.update({
        where: { id: campaignItemId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
    }
  }

  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        items: true,
      },
    });

    if (!campaign) {
      return;
    }

    const allProcessed = campaign.items.every(
      (item) => item.status === 'SENT' || item.status === 'FAILED',
    );

    if (allProcessed && campaign.status === CampaignStatus.PROCESSING) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.COMPLETED,
          finishedAt: new Date(),
        },
      });

      this.logger.log(`Campanha ${campaignId} finalizada`);
    }
  }

  private normalizePhoneNumber(rawPhone: string | null | undefined): string {
    if (!rawPhone) {
      throw new Error('Telefone do contato inválido');
    }

    let phone = rawPhone.replace(/[^\d+]/g, '');
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }

    if (!phone) {
      throw new Error('Telefone do contato inválido');
    }

    return phone;
  }

  private async sendViaEvolutionAPI(
    campaign: any,
    item: any,
    messageContent: string,
  ): Promise<void> {
    const credentials = campaign.serviceInstance.credentials as Record<string, any>;
    const { serverUrl, apiToken, instanceName } = credentials;

    if (!serverUrl || !apiToken || !instanceName) {
      throw new Error('Credenciais da Evolution API incompletas');
    }

    const phone = this.normalizePhoneNumber(item.contact.phone);
    const sendUrl = `${serverUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

    this.logger.log(`Enviando mensagem via Evolution API`, {
      url: sendUrl,
      phone,
      instanceName,
      messageLength: messageContent.length,
    });

    const payload = {
      number: phone,
      text: messageContent,
    };

    try {
      const response = await axios.post(sendUrl, payload, {
        headers: {
          apikey: apiToken,
          'Content-Type': 'application/json',
        },
      });

      const externalId = response.data?.key?.id || response.data?.id || `evol_${Date.now()}`;
      const status = response.data?.status?.toLowerCase() || 'sent';

      this.logger.log(`Mensagem enviada via Evolution API com sucesso`, {
        externalId,
        status,
        phone,
      });
    } catch (error: any) {
      this.logger.error('Erro ao enviar mensagem na Evolution API', {
        error: error.message,
        url: sendUrl,
        payload,
        response: error.response?.data,
        status: error.response?.status,
      });

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;

      throw new Error(`Falha ao enviar mensagem na Evolution API: ${errorMessage}`);
    }
  }

  private async sendViaMetaAPI(
    campaign: any,
    item: any,
    messageContent: string,
  ): Promise<void> {
    const credentials = campaign.serviceInstance.credentials as Record<string, any>;
    const { phoneId, accessToken } = credentials;

    if (!phoneId || !accessToken) {
      throw new Error('Credenciais da Meta incompletas');
    }

    const phone = this.normalizePhoneNumber(item.contact.phone);
    const version = credentials.apiVersion || process.env.META_GRAPH_API_VERSION || 'v18.0';
    const baseUrl = credentials.graphApiUrl || process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com';
    const sendUrl = `${baseUrl.replace(/\/$/, '')}/${version.replace(/^\//, '').replace(/\/$/, '')}/${phoneId}/messages`;

    this.logger.log(`Enviando mensagem via Meta WhatsApp API`, {
      phoneId,
      sendUrl,
      messageLength: messageContent.length,
    });

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: messageContent,
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

      throw new Error(`Falha ao enviar mensagem na Meta API: ${errorMessage}`);
    }
  }
}

