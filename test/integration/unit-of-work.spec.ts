import 'dotenv/config';
import { loadConfig } from '../../src/platform/config/index.js';
import { PrismaService, UnitOfWork } from '../../src/platform/database/index.js';

const UPDATED_AT = new Date('2026-11-16T12:00:00Z');

describe('UnitOfWork (PostgreSQL)', () => {
  let prisma: PrismaService;
  let uow: UnitOfWork;
  const keys: string[] = [];

  const settingKey = (name: string) => {
    const key = `test.uow.${name}`;
    keys.push(key);
    return key;
  };

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env));
    await prisma.onModuleInit();
    uow = new UnitOfWork(prisma);
  });

  afterAll(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: { in: keys } } });
    await prisma.onModuleDestroy();
  });

  it('grava tudo o que foi feito dentro de run quando o trabalho termina', async () => {
    const first = settingKey('commit-1');
    const second = settingKey('commit-2');

    const result = await uow.run(async (tx) => {
      await tx.systemSetting.create({ data: { key: first, value: 1, updatedAt: UPDATED_AT } });
      await tx.systemSetting.create({ data: { key: second, value: 2, updatedAt: UPDATED_AT } });
      return 'feito';
    });

    expect(result).toBe('feito');
    expect(await prisma.systemSetting.count({ where: { key: { in: [first, second] } } })).toBe(2);
  });

  it('desfaz tudo quando o trabalho lança erro', async () => {
    const key = settingKey('rollback');

    await expect(
      uow.run(async (tx) => {
        await tx.systemSetting.create({ data: { key, value: 1, updatedAt: UPDATED_AT } });
        throw new Error('falha no meio do caso de uso');
      }),
    ).rejects.toThrow('falha no meio do caso de uso');

    expect(await prisma.systemSetting.findUnique({ where: { key } })).toBeNull();
  });

  it('desfaz a transação quando o próprio banco recusa uma escrita', async () => {
    const key = settingKey('constraint');

    await expect(
      uow.run(async (tx) => {
        await tx.systemSetting.create({ data: { key, value: 1, updatedAt: UPDATED_AT } });
        await tx.systemSetting.create({ data: { key, value: 2, updatedAt: UPDATED_AT } });
      }),
    ).rejects.toThrow();

    expect(await prisma.systemSetting.findUnique({ where: { key } })).toBeNull();
  });

  it('grava instantes como timestamptz sem perder o fuso', async () => {
    const key = settingKey('timestamptz');

    await uow.run((tx) =>
      tx.systemSetting.create({
        data: { key, value: true, updatedAt: new Date('2026-11-16T23:30:00-03:00') },
      }),
    );

    const rows = await prisma.$queryRaw<{ type: string; utc: string }[]>`
      SELECT pg_typeof(updated_at)::text AS type,
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS utc
      FROM system_settings WHERE key = ${key}`;
    expect(rows).toEqual([{ type: 'timestamp with time zone', utc: '2026-11-17T02:30:00' }]);

    const saved = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
    expect(saved.updatedAt.toISOString()).toBe('2026-11-17T02:30:00.000Z');
  });
});
