import { IsString, IsEnum, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { InstanceProvider } from '@prisma/client';

export class UpdateServiceInstanceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(InstanceProvider)
  @IsOptional()
  provider?: InstanceProvider;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

