import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Campaign, CampaignStatus, Prisma } from '@prisma/client';
import { parseString } from '@fast-csv/parse';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @InjectQueue('campaigns') private campaignsQueue: Queue,
  ) {}

  async create(
    userId: string,
    payload: CreateCampaignDto,
  ): Promise<CampaignResponseDto> {
    const serviceInstance = await this.prisma.serviceInstance.findUnique({
      where: { id: payload.serviceInstanceId },
    });

    if (!serviceInstance) {
      throw new NotFoundException('Instância de serviço não encontrada');
    }

    if (!serviceInstance.isActive) {
      throw new BadRequestException('Instância de serviço inativa');
    }

    if (payload.templateId) {
      const template = await this.prisma.template.findUnique({
        where: { id: payload.templateId },
      });

      if (!template) {
        throw new NotFoundException('Template não encontrado');
      }
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        name: payload.name.trim(),
        serviceInstanceId: payload.serviceInstanceId,
        templateId: payload.templateId,
        supervisorId: userId,
        delaySeconds: payload.delaySeconds ?? 120,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        status: CampaignStatus.PENDING,
      },
      include: {
        serviceInstance: true,
        template: true,
        supervisor: true,
      },
    });

    return this.toResponse(campaign);
  }

  async uploadContacts(
    campaignId: string,
    file: Express.Multer.File,
  ): Promise<{ totalContacts: number }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.status !== CampaignStatus.PENDING) {
      throw new BadRequestException(
        'Não é possível adicionar contatos a uma campanha que não está pendente',
      );
    }

    // Salvar arquivo
    const savedFile = await this.storageService.saveFile({
      buffer: file.buffer,
      originalName: file.originalname,
      subdirectory: 'campaigns',
    });

    // Processar CSV
    const contacts = await this.parseCsv(file.buffer.toString('utf-8'));

    // Criar itens da campanha
    const campaignItems = await Promise.all(
      contacts.map(async (phone) => {
        // Buscar contato existente ou criar
        let contact = await this.prisma.contact.findUnique({
          where: { phone },
        });

        if (!contact) {
          contact = await this.prisma.contact.create({
            data: {
              name: phone,
              phone,
            },
          });
        }

        return {
          campaignId,
          contactId: contact.id,
          status: 'PENDING',
        };
      }),
    );

    await this.prisma.campaignItem.createMany({
      data: campaignItems,
      skipDuplicates: true,
    });

    // Atualizar campanha com caminho do CSV
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        csvPath: savedFile.relativePath,
      },
    });

    return {
      totalContacts: campaignItems.length,
    };
  }

  async start(campaignId: string): Promise<CampaignResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        items: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.status !== CampaignStatus.PENDING) {
      throw new BadRequestException('Campanha já foi iniciada ou finalizada');
    }

    if (campaign.items.length === 0) {
      throw new BadRequestException(
        'Campanha não possui contatos. Faça upload do CSV primeiro.',
      );
    }

    // Atualizar status
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    // Adicionar jobs na fila
    for (const item of campaign.items) {
      await this.campaignsQueue.add(
        'send-message',
        {
          campaignId,
          campaignItemId: item.id,
        },
        {
          delay: 0, // O delay será gerenciado pelo worker
        },
      );
    }

    return this.findOne(campaignId);
  }

  async pause(campaignId: string): Promise<CampaignResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.status !== CampaignStatus.PROCESSING) {
      throw new BadRequestException('Campanha não está em execução');
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.PAUSED,
      },
    });

    return this.findOne(campaignId);
  }

  async resume(campaignId: string): Promise<CampaignResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Campanha não está pausada');
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.PROCESSING,
      },
    });

    return this.findOne(campaignId);
  }

  async findAll() {
    const campaigns = await this.prisma.campaign.findMany({
      include: {
        serviceInstance: true,
        template: true,
        supervisor: true,
        items: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((campaign) => this.toResponse(campaign));
  }

  async findOne(id: string): Promise<CampaignResponseDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        serviceInstance: true,
        template: true,
        supervisor: true,
        items: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    return this.toResponse(campaign);
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.status === CampaignStatus.PROCESSING) {
      throw new BadRequestException(
        'Não é possível remover uma campanha em execução',
      );
    }

    // Remover itens primeiro
    await this.prisma.campaignItem.deleteMany({
      where: { campaignId: id },
    });

    await this.prisma.campaign.delete({ where: { id } });
  }

  private async parseCsv(content: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const phones: string[] = [];

      parseString(content, {
        headers: true,
        ignoreEmpty: true,
        trim: true,
      })
        .on('error', (error) => reject(error))
        .on('data', (row: Record<string, string>) => {
          const phone =
            row['phone'] ||
            row['telefone'] ||
            row['celular'] ||
            row['whatsapp'];

          if (phone) {
            phones.push(this.normalizePhone(phone));
          }
        })
        .on('end', () => {
          resolve([...new Set(phones)]); // Remove duplicados
        });
    });
  }

  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+') && cleaned.length >= 10) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  private toResponse(campaign: any): CampaignResponseDto {
    const items = campaign.items || [];
    const totalContacts = items.length;
    const sentCount = items.filter((i: any) => i.status === 'SENT').length;
    const failedCount = items.filter((i: any) => i.status === 'FAILED').length;
    const pendingCount = items.filter((i: any) => i.status === 'PENDING').length;

    return {
      id: campaign.id,
      name: campaign.name,
      serviceInstanceId: campaign.serviceInstanceId,
      serviceInstanceName: campaign.serviceInstance?.name,
      templateId: campaign.templateId,
      templateName: campaign.template?.name ?? null,
      supervisorId: campaign.supervisorId,
      supervisorName: campaign.supervisor?.name,
      csvPath: campaign.csvPath,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      finishedAt: campaign.finishedAt,
      delaySeconds: campaign.delaySeconds,
      totalContacts,
      sentCount,
      failedCount,
      pendingCount,
    };
  }
}

