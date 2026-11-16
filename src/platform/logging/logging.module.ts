import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';
import { ID_GENERATOR, type IdGenerator } from '../clock-and-ids/index.js';
import { APP_CONFIG, type AppConfig } from '../config/index.js';
import { REDACTED_PATHS, REDACTION_CENSOR } from './redaction.js';

/** Destino dos logs. Nulo = stdout; os testes trocam por um stream que captura as linhas. */
export const LOG_DESTINATION = Symbol('LOG_DESTINATION');

/** Logs estruturados em JSON (pino) com requestId, userId e módulo. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      providers: [{ provide: LOG_DESTINATION, useValue: null }],
      inject: [APP_CONFIG, ID_GENERATOR, LOG_DESTINATION],
      useFactory: (config: AppConfig, ids: IdGenerator, destination: DestinationStream | null) => {
        const options: Options = {
          level: config.logLevel,
          base: { process: config.processRole },
          redact: { paths: REDACTED_PATHS, censor: REDACTION_CENSOR },
          // O id vem do createFastifyAdapter; o fallback só cobre requisições fora dele.
          genReqId: (req) => (typeof req.id === 'string' ? req.id : ids.next()),
          customProps: (req) => ({
            requestId: req.id,
            userId: (req as { user?: { id?: string } }).user?.id,
          }),
          autoLogging: { ignore: (req) => req.url === '/v1/health' },
        };
        if (destination) return { pinoHttp: [options, destination] };
        return {
          pinoHttp: {
            ...options,
            transport:
              config.nodeEnv === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
