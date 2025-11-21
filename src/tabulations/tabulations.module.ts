import { Module } from '@nestjs/common';
import { TabulationsService } from './tabulations.service';
import { TabulationsController } from './tabulations.controller';

@Module({
  controllers: [TabulationsController],
  providers: [TabulationsService],
  exports: [TabulationsService],
})
export class TabulationsModule {}

