import 'dotenv/config';
import { BADGES } from '../../prisma/seed/badges.js';
import { EQUIPMENT, MUSCLE_GROUPS } from '../../prisma/seed/catalogs.js';
import { runSeed } from '../../prisma/seed/run.js';
import { SYSTEM_SETTINGS_SEED } from '../../prisma/seed/system-settings.js';
import { loadConfig } from '../../src/platform/config/index.js';
import { PrismaService } from '../../src/platform/database/index.js';

const FIRST_RUN = new Date('2026-11-16T12:00:00Z');
const SECOND_RUN = new Date('2026-11-17T12:00:00Z');

describe('seed (PostgreSQL)', () => {
  let prisma: PrismaService;

  const counts = async () => ({
    muscleGroups: await prisma.muscleGroup.count({
      where: { key: { in: MUSCLE_GROUPS.map((g) => g.key) } },
    }),
    equipment: await prisma.equipment.count({
      where: { key: { in: EQUIPMENT.map((e) => e.key) } },
    }),
    badges: await prisma.badge.count({ where: { key: { in: BADGES.map((b) => b.key) } } }),
    systemSettings: await prisma.systemSetting.count({
      where: { key: { in: Object.keys(SYSTEM_SETTINGS_SEED) } },
    }),
  });

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env));
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('rodar duas vezes não duplica nada', async () => {
    const summary = await runSeed(prisma, FIRST_RUN);
    await runSeed(prisma, SECOND_RUN);

    expect(await counts()).toEqual(summary);
  });

  it('grava o catálogo na ordem definida e o critério do badge como dado', async () => {
    await runSeed(prisma, FIRST_RUN);

    const groups = await prisma.muscleGroup.findMany({
      where: { key: { in: MUSCLE_GROUPS.map((g) => g.key) } },
      orderBy: { sortOrder: 'asc' },
    });
    expect(groups.map((g) => g.key)).toEqual(MUSCLE_GROUPS.map((g) => g.key));

    const legend = await prisma.badge.findUniqueOrThrow({ where: { key: 'LEGEND_OF_STRENGTH' } });
    expect(legend.criterion).toEqual({
      type: 'EXERCISE_LOAD',
      exerciseBadgeKey: 'DEADLIFT',
      loadKg: 200,
    });
  });

  it('corrige rótulos do catálogo ao rodar de novo', async () => {
    await runSeed(prisma, FIRST_RUN);
    await prisma.muscleGroup.update({ where: { key: 'CHEST' }, data: { label: 'Peitoral' } });

    await runSeed(prisma, SECOND_RUN);

    expect(await prisma.muscleGroup.findUniqueOrThrow({ where: { key: 'CHEST' } })).toMatchObject({
      label: 'Peito',
    });
  });

  it('não sobrescreve um parâmetro de sistema ajustado na base', async () => {
    await runSeed(prisma, FIRST_RUN);
    await prisma.systemSetting.update({
      where: { key: 'weeklyGoalDays' },
      data: { value: 4, updatedAt: FIRST_RUN },
    });

    await runSeed(prisma, SECOND_RUN);

    const setting = await prisma.systemSetting.findUniqueOrThrow({
      where: { key: 'weeklyGoalDays' },
    });
    expect(setting.value).toBe(4);
    await prisma.systemSetting.update({
      where: { key: 'weeklyGoalDays' },
      data: { value: SYSTEM_SETTINGS_SEED.weeklyGoalDays },
    });
  });
});
