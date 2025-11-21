import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  serviceInstanceId: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsInt()
  @Min(30)
  @IsOptional()
  delaySeconds?: number; // Delay entre envios (padrão: 120s)

  @IsDateString()
  @IsOptional()
  scheduledAt?: string; // Data/hora agendada
}

