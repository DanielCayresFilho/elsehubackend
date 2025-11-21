import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Contact, Prisma } from '@prisma/client';
import { parseString } from '@fast-csv/parse';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ContactResponseDto } from './dto/contact-response.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import {
  ImportContactsResultDto,
  ImportContactsRowErrorDto,
} from './dto/import-contacts.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { UploadedCsvFile } from './types/uploaded-csv-file.type';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(payload: CreateContactDto): Promise<ContactResponseDto> {
    try {
      const contact = await this.prisma.contact.create({
        data: {
          name: payload.name.trim(),
          phone: this.normalizePhone(payload.phone),
          cpf: payload.cpf?.trim(),
          additional1: payload.additional1?.trim(),
          additional2: payload.additional2?.trim(),
        },
      });

      return this.toResponse(contact);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Telefone já cadastrado em outro contato',
        );
      }
      throw error;
    }
  }

  async findAll(query: ListContactsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput | undefined = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
            { cpf: { contains: query.search } },
          ],
        }
      : undefined;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: data.map((contact) => this.toResponse(contact)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string): Promise<ContactResponseDto> {
    const contact = await this.prisma.contact.findUnique({ where: { id } });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    return this.toResponse(contact);
  }

  async update(
    id: string,
    payload: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    const contact = await this.prisma.contact.findUnique({ where: { id } });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    try {
      const updated = await this.prisma.contact.update({
        where: { id },
        data: {
          name: payload.name?.trim() ?? contact.name,
          phone: payload.phone
            ? this.normalizePhone(payload.phone)
            : contact.phone,
          cpf: payload.cpf?.trim() ?? contact.cpf,
          additional1: payload.additional1?.trim() ?? contact.additional1,
          additional2: payload.additional2?.trim() ?? contact.additional2,
        },
      });

      return this.toResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Telefone já cadastrado em outro contato',
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const contact = await this.prisma.contact.findUnique({ where: { id } });

    if (!contact) {
      throw new NotFoundException('Contato não encontrado');
    }

    await this.prisma.contact.delete({ where: { id } });
  }

  async importFromCsv(
    file: UploadedCsvFile | null | undefined,
  ): Promise<ImportContactsResultDto> {
    if (!file) {
      throw new BadRequestException('Arquivo CSV é obrigatório');
    }

    if (!this.isCsvFile(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Formato inválido. Envie um arquivo .csv',
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Não foi possível ler o arquivo enviado');
    }

    const savedFile = await this.storageService.saveFile({
      buffer: file.buffer,
      originalName: file.originalname ?? 'contatos.csv',
      subdirectory: 'imports/contacts',
    });

    const buffer = file.buffer.toString('utf-8');

    const parsed = await this.parseCsv(buffer);

    if (parsed.rows.length === 0) {
      return {
        totalRows: parsed.totalRows,
        processedRows: 0,
        created: 0,
        skipped: parsed.totalRows,
        errors: parsed.errors,
      };
    }

    const result = await this.prisma.contact.createMany({
      data: parsed.rows.map((row) => ({
        name: row.name,
        phone: row.phone,
        cpf: row.cpf,
        additional1: row.additional1,
        additional2: row.additional2,
      })),
      skipDuplicates: true,
    });

    const created = result.count;
    const processedRows = parsed.rows.length;

    return {
      totalRows: parsed.totalRows,
      processedRows,
      created,
      skipped: parsed.totalRows - created,
      storedFilePath: savedFile.relativePath,
      storedFileName: savedFile.filename,
      storedFileSize: savedFile.size,
      errors: parsed.errors,
    };
  }

  private async parseCsv(content: string) {
    return new Promise<{
      rows: CreateContactDto[];
      totalRows: number;
      errors: ImportContactsRowErrorDto[];
    }>((resolve, reject) => {
      const rows: CreateContactDto[] = [];
      const errors: ImportContactsRowErrorDto[] = [];
      let rowNumber = 1;

      parseString(content, {
        headers: true,
        ignoreEmpty: true,
        trim: true,
      })
        .on('error', (error) => reject(error))
        .on('data', (row: Record<string, string>) => {
          rowNumber += 1;
          const normalized = this.normalizeRow(row);
          const mapped = this.mapRowToContact(normalized);

          if (!mapped) {
            errors.push({
              rowNumber,
              reason: 'Linha vazia ou sem dados válidos',
            });
            return;
          }

          if (!mapped.name || !mapped.phone) {
            errors.push({
              rowNumber,
              phone: mapped.phone,
              reason: 'Campos obrigatórios faltando (nome ou telefone)',
            });
            return;
          }

          rows.push(mapped);
        })
        .on('end', (totalRows: number) => {
          resolve({ rows: this.deduplicateRows(rows), totalRows, errors });
        });
    });
  }

  private deduplicateRows(rows: CreateContactDto[]): CreateContactDto[] {
    const map = new Map<string, CreateContactDto>();
    rows.forEach((row) => {
      const normalizedPhone = this.normalizePhone(row.phone);
      if (!map.has(normalizedPhone)) {
        map.set(normalizedPhone, {
          ...row,
          phone: normalizedPhone,
        });
      }
    });
    return Array.from(map.values());
  }

  private normalizeRow(row: Record<string, string>) {
    return Object.entries(row).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const normalizedKey = key.trim().toLowerCase();
        acc[normalizedKey] = (value ?? '').toString().trim();
        return acc;
      },
      {},
    );
  }

  private mapRowToContact(
    row: Record<string, string>,
  ): CreateContactDto | null {
    const name = row['name'] || row['nome'];
    const phone =
      row['phone'] ||
      row['telefone'] ||
      row['celular'] ||
      row['whatsapp'] ||
      row['telefone_1'];
    const cpf = row['cpf'];
    const additional1 = row['additional1'] || row['adicional_1'];
    const additional2 = row['additional2'] || row['adicional_2'];

    if (!name && !phone) {
      return null;
    }

    return {
      name: name ?? '',
      phone: phone ?? '',
      cpf: cpf || undefined,
      additional1: additional1 || undefined,
      additional2: additional2 || undefined,
    };
  }

  private normalizePhone(phone: string) {
    const cleaned = phone.replace(/[^\d+]/g, '');

    if (!cleaned) {
      return phone;
    }

    if (!cleaned.startsWith('+') && cleaned.length >= 10) {
      return `+${cleaned}`;
    }

    return cleaned;
  }

  private isCsvFile(mime?: string | null) {
    if (!mime) {
      return false;
    }

    return (
      mime === 'text/csv' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'text/plain'
    );
  }

  private toResponse(contact: Contact): ContactResponseDto {
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      cpf: contact.cpf,
      additional1: contact.additional1,
      additional2: contact.additional2,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}
