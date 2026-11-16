import { Writable } from 'node:stream';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { SystemClock, UuidV7Generator } from '../../src/platform/clock-and-ids/index.js';
import { APP_CONFIG, loadConfig } from '../../src/platform/config/index.js';
import { PrismaService } from '../../src/platform/database/index.js';
import { createFastifyAdapter, LOG_DESTINATION } from '../../src/platform/logging/index.js';

interface LogLine {
  msg?: string;
  requestId?: string;
  req?: { id?: string; headers?: Record<string, string> };
}

describe('logs estruturados por requisição', () => {
  let app: NestFastifyApplication;
  const lines: string[] = [];
  const capture = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: vi.fn().mockResolvedValue([1]) })
      .overrideProvider(APP_CONFIG)
      .useValue({ ...loadConfig(process.env), logLevel: 'info' })
      .overrideProvider(LOG_DESTINATION)
      .useValue(capture)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(new UuidV7Generator(new SystemClock())),
    );
    app.setGlobalPrefix('v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function completedLogFor(requestId: string): Promise<LogLine> {
    let found: LogLine | undefined;
    await vi.waitFor(() => {
      found = lines
        .map((line) => JSON.parse(line) as LogLine)
        .find((log) => log.msg === 'request completed' && log.requestId === requestId);
      if (!found) throw new Error('log ainda não escrito');
    });
    return found!;
  }

  it('cada requisição gera um log JSON com o mesmo requestId do cabeçalho', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/rota-qualquer')
      .set('X-Request-Id', 'req-log-0001');
    expect(res.headers['x-request-id']).toBe('req-log-0001');

    const log = await completedLogFor('req-log-0001');
    expect(log.req?.id).toBe('req-log-0001');
  });

  it('sem cabeçalho, o requestId gerado aparece no log e na resposta', async () => {
    const res = await request(app.getHttpServer()).get('/v1/rota-qualquer');
    const generated = res.headers['x-request-id'] as string;
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    await completedLogFor(generated);
  });

  it('oculta token e cookie no log', async () => {
    await request(app.getHttpServer())
      .get('/v1/rota-qualquer')
      .set('X-Request-Id', 'req-log-0002')
      .set('Authorization', 'Bearer token-secreto')
      .set('Cookie', 'refresh=rt-secreto');

    const log = await completedLogFor('req-log-0002');
    expect(log.req?.headers?.authorization).toBe('[REDACTED]');
    expect(log.req?.headers?.cookie).toBe('[REDACTED]');
    expect(lines.join('\n')).not.toMatch(/token-secreto|rt-secreto/);
  });
});
