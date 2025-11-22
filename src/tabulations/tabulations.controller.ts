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
} from '@nestjs/common';

import { TabulationsService } from './tabulations.service';
import { CreateTabulationDto } from './dto/create-tabulation.dto';
import { UpdateTabulationDto } from './dto/update-tabulation.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('tabulations')
export class TabulationsController {
  constructor(private readonly tabulationsService: TabulationsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  create(@Body() createDto: CreateTabulationDto) {
    console.log('[TabulationsController] Creating tabulation:', {
      name: createDto.name,
    });
    return this.tabulationsService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findAll() {
    return this.tabulationsService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  findOne(@Param('id') id: string) {
    return this.tabulationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  update(@Param('id') id: string, @Body() updateDto: UpdateTabulationDto) {
    return this.tabulationsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tabulationsService.remove(id);
  }
}

