import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { SystemClock, UuidV7Generator } from './platform/clock-and-ids/index.js';
import { APP_CONFIG, type AppConfig } from './platform/config/index.js';
import { createFastifyAdapter } from './platform/logging/index.js';

async function bootstrap(): Promise<void> {
  // O adaptador nasce antes do contêiner de DI, então recebe o gerador de ids diretamente.
  const adapter = createFastifyAdapter(new UuidV7Generator(new SystemClock()));
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  // Fastify escuta só em localhost por padrão; 0.0.0.0 é necessário dentro de contêiner.
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
