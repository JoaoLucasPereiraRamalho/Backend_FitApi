import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock-and-ids/index.js';
import { PrismaService } from './prisma.service.js';

type CheckStatus = 'ok' | 'down';

export interface HealthReport {
  status: CheckStatus;
  checks: { database: CheckStatus };
  checkedAt: string;
}

/** O suficiente da resposta HTTP para trocar o status; serve para Fastify e Express. */
export interface StatusSettable {
  status(code: number): unknown;
}

/** GET /v1/health — público, para monitoramento. 503 quando o banco não responde. O envelope { data } vem do EnvelopeInterceptor. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res({ passthrough: true }) reply: StatusSettable): Promise<HealthReport> {
    const database = await this.checkDatabase();
    if (database === 'down') reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: database, checks: { database }, checkedAt: this.clock.now().toISOString() };
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
