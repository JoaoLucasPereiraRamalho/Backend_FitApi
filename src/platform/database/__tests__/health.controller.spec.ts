import type { Mock } from 'vitest';
import { FixedClock } from '../../clock-and-ids/index.js';
import { HealthController, type StatusSettable } from '../health.controller.js';
import type { PrismaService } from '../prisma.service.js';

function makeController(queryRaw: Mock) {
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return new HealthController(prisma, new FixedClock('2026-11-12T14:03:22Z'));
}

function fakeResponse() {
  const status = vi.fn();
  return { res: { status } as StatusSettable, status };
}

describe('HealthController', () => {
  it('responde ok quando o banco responde', async () => {
    const { res, status } = fakeResponse();
    const result = await makeController(vi.fn().mockResolvedValue([1])).check(res);
    expect(result).toEqual({
      status: 'ok',
      checks: { database: 'ok' },
      checkedAt: '2026-11-12T14:03:22.000Z',
    });
    expect(status).not.toHaveBeenCalled();
  });

  it('responde 503 e down quando o banco falha', async () => {
    const { res, status } = fakeResponse();
    const result = await makeController(vi.fn().mockRejectedValue(new Error('offline'))).check(res);
    expect(result.status).toBe('down');
    expect(status).toHaveBeenCalledWith(503);
  });
});
