import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { StorageModule } from './storage/storage.module';
import { ServiceInstancesModule } from './service-instances/service-instances.module';
import { TemplatesModule } from './templates/templates.module';
import { TabulationsModule } from './tabulations/tabulations.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { WebsocketsModule } from './websockets/websockets.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ReportsModule } from './reports/reports.module';
import { LoggerModule } from './logger/logger.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HttpLoggerMiddleware } from './logger/http-logger.middleware';
import { JwtAccessGuard } from './common/guards/jwt-access.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: path.resolve(
            process.cwd(),
            configService.get<string>('storage.basePath') ?? './storage',
          ),
          serveRoot: '/media',
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [{
        ttl: configService.get<number>('throttler.ttl') ?? 60000,
        limit: configService.get<number>('throttler.limit') ?? 30,
      }],
    }),
    PrismaModule,
    StorageModule,
    LoggerModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    ServiceInstancesModule,
    TemplatesModule,
    TabulationsModule,
    ConversationsModule,
    MessagesModule,
    WebsocketsModule,
    WebhooksModule,
    CampaignsModule,
    ReportsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
