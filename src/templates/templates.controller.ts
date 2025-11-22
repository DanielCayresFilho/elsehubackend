import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';

import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  create(@Body() createDto: CreateTemplateDto) {
    console.log('[TemplatesController] Creating template:', {
      name: createDto.name,
      serviceInstanceId: createDto.serviceInstanceId,
      hasBody: !!createDto.body,
    });
    return this.templatesService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findAll(@Query('serviceInstanceId') serviceInstanceId?: string) {
    if (serviceInstanceId) {
      return this.templatesService.findByServiceInstance(serviceInstanceId);
    }
    return this.templatesService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  update(@Param('id') id: string, @Body() updateDto: UpdateTemplateDto) {
    return this.templatesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}

