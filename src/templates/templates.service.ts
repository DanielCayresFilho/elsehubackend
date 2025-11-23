import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Template } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateResponseDto } from './dto/template-response.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateTemplateDto): Promise<TemplateResponseDto> {
    const serviceInstance = await this.prisma.serviceInstance.findUnique({
      where: { id: payload.serviceInstanceId },
    });

    if (!serviceInstance) {
      throw new NotFoundException('Instância de serviço não encontrada');
    }

    const template = await this.prisma.template.create({
      data: {
        name: payload.name.trim(),
        body: payload.body,
        metaTemplateId: payload.metaTemplateId,
        language: payload.language ?? 'pt_BR',
        variables: payload.variables ?? undefined,
        serviceInstanceId: payload.serviceInstanceId,
      },
      include: {
        serviceInstance: true,
      },
    });

    return this.toResponse(template);
  }

  async findAll() {
    const templates = await this.prisma.template.findMany({
      include: {
        serviceInstance: true,
      },
      orderBy: { name: 'asc' },
    });

    return templates.map((template) => this.toResponse(template));
  }

  async findByServiceInstance(serviceInstanceId: string) {
    const templates = await this.prisma.template.findMany({
      where: { serviceInstanceId },
      include: {
        serviceInstance: true,
      },
      orderBy: { name: 'asc' },
    });

    return templates.map((template) => this.toResponse(template));
  }

  async findOne(id: string): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        serviceInstance: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template não encontrado');
    }

    return this.toResponse(template);
  }

  async update(
    id: string,
    payload: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template não encontrado');
    }

    if (payload.serviceInstanceId) {
      const serviceInstance = await this.prisma.serviceInstance.findUnique({
        where: { id: payload.serviceInstanceId },
      });

      if (!serviceInstance) {
        throw new NotFoundException('Instância de serviço não encontrada');
      }
    }

    const updated = await this.prisma.template.update({
      where: { id },
      data: {
        name: payload.name?.trim(),
        body: payload.body,
        metaTemplateId: payload.metaTemplateId,
        language: payload.language,
        variables: payload.variables,
        serviceInstanceId: payload.serviceInstanceId,
      },
      include: {
        serviceInstance: true,
      },
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        campaigns: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template não encontrado');
    }

    if (template.campaigns.length > 0) {
      throw new BadRequestException(
        'Não é possível remover um template que está sendo usado em campanhas',
      );
    }

    await this.prisma.template.delete({ where: { id } });
  }

  private toResponse(
    template: Template & { serviceInstance?: { name: string } },
  ): TemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      body: template.body,
      metaTemplateId: template.metaTemplateId,
      language: template.language,
      variables: template.variables as Record<string, any> | null,
      serviceInstanceId: template.serviceInstanceId,
      serviceInstanceName: template.serviceInstance?.name,
    };
  }
}

