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
    this.logger.log('Webhook Evolution recebido');
    
    try {
      await this.webhooksService.handleEvolutionWebhook(payload);
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao processar webhook Evolution: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

