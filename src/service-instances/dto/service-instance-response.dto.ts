import { InstanceProvider } from '@prisma/client';

export class ServiceInstanceResponseDto {
  id: string;
  name: string;
  provider: InstanceProvider;
  credentials: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

