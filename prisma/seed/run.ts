import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { BADGES } from './badges.js';
import { EQUIPMENT, MUSCLE_GROUPS } from './catalogs.js';
import { SYSTEM_SETTINGS_SEED } from './system-settings.js';

export interface SeedSummary {
  muscleGroups: number;
  equipment: number;
  badges: number;
  systemSettings: number;
}

/**
 * Seed idempotente: rodar de novo não duplica nada. Catálogos e badges são definidos no código e
 * o seed atualiza rótulos e critérios; parâmetros de sistema só são criados quando faltam, para não
 * desfazer um ajuste feito na base. Tudo numa transação. Exercícios base entram na Sprint 3.
 */
export async function runSeed(prisma: PrismaClient, now: Date): Promise<SeedSummary> {
  await prisma.$transaction(async (tx) => {
    for (const [sortOrder, { key, label }] of MUSCLE_GROUPS.entries()) {
      await tx.muscleGroup.upsert({
        where: { key },
        create: { key, label, sortOrder },
        update: { label, sortOrder },
      });
    }
    for (const [sortOrder, { key, label }] of EQUIPMENT.entries()) {
      await tx.equipment.upsert({
        where: { key },
        create: { key, label, sortOrder },
        update: { label, sortOrder },
      });
    }
    for (const [sortOrder, { key, ...badge }] of BADGES.entries()) {
      await tx.badge.upsert({
        where: { key },
        create: { key, ...badge, sortOrder },
        update: { ...badge, sortOrder },
      });
    }
    for (const [key, value] of Object.entries(SYSTEM_SETTINGS_SEED)) {
      await tx.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedAt: now },
        update: {},
      });
    }
  });

  return {
    muscleGroups: MUSCLE_GROUPS.length,
    equipment: EQUIPMENT.length,
    badges: BADGES.length,
    systemSettings: Object.keys(SYSTEM_SETTINGS_SEED).length,
  };
}
