import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Tabulation, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTabulationDto } from './dto/create-tabulation.dto';
import { UpdateTabulationDto } from './dto/update-tabulation.dto';
import { TabulationResponseDto } from './dto/tabulation-response.dto';

@Injectable()
export class TabulationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateTabulationDto): Promise<TabulationResponseDto> {
    try {
      const tabulation = await this.prisma.tabulation.create({
        data: {
          name: payload.name.trim(),
        },
      });

      return this.toResponse(tabulation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Já existe uma tabulação com esse nome');
      }
      throw error;
    }
  }

  async findAll() {
    const tabulations = await this.prisma.tabulation.findMany({
      orderBy: { name: 'asc' },
    });

    return tabulations.map((tabulation) => this.toResponse(tabulation));
  }

  async findOne(id: string): Promise<TabulationResponseDto> {
    const tabulation = await this.prisma.tabulation.findUnique({
      where: { id },
    });

    if (!tabulation) {
      throw new NotFoundException('Tabulação não encontrada');
    }

    return this.toResponse(tabulation);
  }

  async update(
    id: string,
    payload: UpdateTabulationDto,
  ): Promise<TabulationResponseDto> {
    const tabulation = await this.prisma.tabulation.findUnique({
      where: { id },
    });

    if (!tabulation) {
      throw new NotFoundException('Tabulação não encontrada');
    }

    try {
      const updated = await this.prisma.tabulation.update({
        where: { id },
        data: {
          name: payload.name?.trim(),
        },
      });

      return this.toResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Já existe uma tabulação com esse nome');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const tabulation = await this.prisma.tabulation.findUnique({
      where: { id },
      include: {
        finishedConversations: true,
      },
    });

    if (!tabulation) {
      throw new NotFoundException('Tabulação não encontrada');
    }

    if (tabulation.finishedConversations.length > 0) {
      throw new BadRequestException(
        'Não é possível remover uma tabulação com conversas finalizadas associadas',
      );
    }

    await this.prisma.tabulation.delete({ where: { id } });
  }

  private toResponse(tabulation: Tabulation): TabulationResponseDto {
    return {
      id: tabulation.id,
      name: tabulation.name,
    };
  }
}

