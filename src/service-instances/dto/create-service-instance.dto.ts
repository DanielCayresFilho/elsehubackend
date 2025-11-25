import { IsString, IsEnum, IsNotEmpty, IsObject } from 'class-validator';
import { InstanceProvider } from '@prisma/client';

export class CreateServiceInstanceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEnum(InstanceProvider)
  provider: InstanceProvider;

  @IsObject()
  credentials: Record<string, any>;
}

