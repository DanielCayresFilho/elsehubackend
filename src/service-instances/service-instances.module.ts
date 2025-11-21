import { Module } from '@nestjs/common';
import { ServiceInstancesService } from './service-instances.service';
import { ServiceInstancesController } from './service-instances.controller';

@Module({
  controllers: [ServiceInstancesController],
  providers: [ServiceInstancesService],
  exports: [ServiceInstancesService],
})
export class ServiceInstancesModule {}

