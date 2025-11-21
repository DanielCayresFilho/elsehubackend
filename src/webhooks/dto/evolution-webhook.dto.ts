import { IsString, IsObject, IsOptional } from 'class-validator';

export class EvolutionWebhookDto {
  @IsString()
  event: string;

  @IsString()
  instance: string;

  @IsObject()
  data: EvolutionWebhookData;
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

