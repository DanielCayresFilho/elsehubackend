import { IsString, IsObject, IsOptional } from 'class-validator';

export class EvolutionWebhookDto {
  @IsString()
  event: string;

  @IsString()
  instance: string;

  @IsObject()
  data: EvolutionWebhookData;

  // Campos extras que a Evolution API envia (opcionais)
  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  date_time?: string;

  @IsOptional()
  @IsString()
  sender?: string;

  @IsOptional()
  @IsString()
  server_url?: string;

  @IsOptional()
  @IsString()
  apikey?: string;
}

export interface EvolutionWebhookData {
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: any;
    documentMessage?: any;
    audioMessage?: any;
    videoMessage?: any;
  };
  messageTimestamp?: number;
  pushName?: string;
  status?: string;
}

