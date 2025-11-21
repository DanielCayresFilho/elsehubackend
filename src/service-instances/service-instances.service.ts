import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ServiceInstance } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceInstanceDto } from './dto/create-service-instance.dto';
import { UpdateServiceInstanceDto } from './dto/update-service-instance.dto';
import { ServiceInstanceResponseDto } from './dto/service-instance-response.dto';

@Injectable()
export class ServiceInstancesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    payload: CreateServiceInstanceDto,
  ): Promise<ServiceInstanceResponseDto> {
    this.validateCredentials(payload.provider, payload.credentials);

    const instance = await this.prisma.serviceInstance.create({
      data: {
        name: payload.name.trim(),
        provider: payload.provider,
        credentials: payload.credentials,
      },
    });

    return this.toResponse(instance);
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

