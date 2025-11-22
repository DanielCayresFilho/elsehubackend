import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createDto: CreateCampaignDto,
  ) {
    console.log('[CampaignsController] Creating campaign:', {
      name: createDto.name,
      serviceInstanceId: createDto.serviceInstanceId,
      templateId: createDto.templateId,
      userId: user.id,
    });
    return this.campaignsService.create(user.id, createDto);
  }

  @Post(':id/upload')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  uploadContacts(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.campaignsService.uploadContacts(id, file);
  }

  @Post(':id/start')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  start(@Param('id') id: string) {
    return this.campaignsService.start(id);
  }

  @Patch(':id/pause')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  pause(@Param('id') id: string) {
    return this.campaignsService.pause(id);
  }

  @Patch(':id/resume')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  resume(@Param('id') id: string) {
    return this.campaignsService.resume(id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }
}

