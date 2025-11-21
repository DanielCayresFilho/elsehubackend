import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignStatus } from '@prisma/client';

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

      // TODO: Implementar envio real via Meta/Evolution API
      // Por enquanto, apenas simulamos o envio
      this.logger.log(
        `Enviando mensagem para ${item.contact.phone} (campanha: ${campaign.name})`,
      );

      // Simular envio (substituir por integração real)
      const success = Math.random() > 0.1; // 90% de sucesso

      if (success) {
        await this.prisma.campaignItem.update({
          where: { id: campaignItemId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        this.logger.log(`Mensagem enviada com sucesso: ${item.contact.phone}`);
      } else {
        await this.prisma.campaignItem.update({
          where: { id: campaignItemId },
          data: {
            status: 'FAILED',
            errorMessage: 'Erro simulado de envio',
          },
        });
        this.logger.error(
          `Falha ao enviar mensagem: ${item.contact.phone}`,
        );
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
}

