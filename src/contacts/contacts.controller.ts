import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { UploadedCsvFile } from './types/uploaded-csv-file.type';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  @Post()
  create(@Body() payload: CreateContactDto) {
    console.log('[ContactsController] Creating contact:', {
      name: payload.name,
      phone: payload.phone,
      cpf: payload.cpf,
    });
    return this.contactsService.create(payload);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  @Get()
  findAll(@Query() query: ListContactsQueryDto) {
    return this.contactsService.findAll(query);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateContactDto) {
    return this.contactsService.update(id, payload);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }

  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  @Post('import/csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    }),
  )
  importFromCsv(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: MAX_FILE_SIZE,
            message: 'Arquivo excede o limite de 5MB',
          }),
          new FileTypeValidator({
            fileType: /(csv|vnd\.ms-excel|plain)$/,
          }),
        ],
      }),
    )
    file: UploadedCsvFile,
  ) {
    return this.contactsService.importFromCsv(file);
  }
}
