import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { WebhooksService } from './webhooks.service';
import { MetaWebhookDto } from './dto/meta-webhook.dto';
import { EvolutionWebhookDto } from './dto/evolution-webhook.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('webhooks')
@Public()
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  // Webhook da Meta (WhatsApp Business API)
  @Get('meta')
  verifyMetaWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    // Verificação do webhook (configuração inicial)
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'elsehu_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      this.logger.log('Webhook Meta verificado com sucesso');
      return challenge;
    }

    this.logger.warn('Falha na verificação do webhook Meta');
    return HttpStatus.FORBIDDEN;
  }

  @Post('meta')
  @HttpCode(HttpStatus.OK)
  async handleMetaWebhook(@Body() payload: MetaWebhookDto) {
    this.logger.log('Webhook Meta recebido');
    
    try {
      await this.webhooksService.handleMetaWebhook(payload);
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao processar webhook Meta: ${error.message}`);
      // Retornar 200 mesmo com erro para evitar retry excessivo da Meta
      return { success: false, error: error.message };
    }
  }

  // Webhook da Evolution API
  @Post('evolution')
  @HttpCode(HttpStatus.OK)
  async handleEvolutionWebhook(@Body() payload: EvolutionWebhookDto) {
    // Log completo do payload para debug
    this.logger.log('Webhook Evolution recebido - Payload completo', {
      event: payload.event,
      instance: payload.instance,
      hasData: !!payload.data,
      remoteJid: payload.data?.key?.remoteJid,
      fromMe: payload.data?.key?.fromMe,
      // Campos opcionais que podem conter informações úteis
      sender: payload.sender,
      destination: payload.destination,
      date_time: payload.date_time,
      server_url: payload.server_url,
      // Todos os campos do data
      dataKeys: payload.data ? Object.keys(payload.data) : [],
      pushName: payload.data?.pushName,
      messageType: payload.data?.messageType,
      messageTimestamp: payload.data?.messageTimestamp,
      instanceId: payload.data?.instanceId,
      source: payload.data?.source,
      status: payload.data?.status,
      // Log completo do payload (serializado para evitar problemas de referência circular)
      fullPayload: JSON.stringify(payload, null, 2),
    });
    
    try {
      await this.webhooksService.handleEvolutionWebhook(payload);
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao processar webhook Evolution: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }
}

