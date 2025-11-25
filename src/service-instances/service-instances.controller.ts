import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { ServiceInstancesService } from './service-instances.service';
import { CreateServiceInstanceDto } from './dto/create-service-instance.dto';
import { UpdateServiceInstanceDto } from './dto/update-service-instance.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('service-instances')
export class ServiceInstancesController {
  constructor(
    private readonly serviceInstancesService: ServiceInstancesService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createDto: CreateServiceInstanceDto) {
    console.log('[ServiceInstancesController] Creating instance:', {
      name: createDto.name,
      provider: createDto.provider,
      hasCredentials: !!createDto.credentials,
    });
    return this.serviceInstancesService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  findAll(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.serviceInstancesService.findAll(include);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  findOne(@Param('id') id: string) {
    return this.serviceInstancesService.findOne(id);
  }

  @Get(':id/qrcode')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getQrCode(@Param('id') id: string) {
    return this.serviceInstancesService.getQrCode(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateDto: UpdateServiceInstanceDto) {
    return this.serviceInstancesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.serviceInstancesService.remove(id);
  }
}

