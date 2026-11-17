import { BADGES, STRENGTH_EXERCISE_KEYS } from '../../prisma/seed/badges.js';
import { EQUIPMENT, MUSCLE_GROUPS } from '../../prisma/seed/catalogs.js';
import { SYSTEM_SETTINGS_SEED } from '../../prisma/seed/system-settings.js';

const KEY_FORMAT = /^[A-Z][A-Z0-9_]*$/;
const duplicates = (keys: string[]) => keys.filter((key, i) => keys.indexOf(key) !== i);

describe('dados do seed', () => {
  it.each([
    ['grupamentos', MUSCLE_GROUPS.map((g) => g.key)],
    ['equipamentos', EQUIPMENT.map((e) => e.key)],
    ['badges', BADGES.map((b) => b.key)],
  ])('%s têm chaves únicas em maiúsculas', (_name, keys) => {
    expect(duplicates(keys)).toEqual([]);
    expect(keys.filter((key) => !KEY_FORMAT.test(key))).toEqual([]);
  });

  it('tem os grupamentos da biblioteca da Sprint 3', () => {
    expect(MUSCLE_GROUPS.map((g) => g.label)).toEqual([
      'Peito',
      'Costas',
      'Ombros',
      'Bíceps',
      'Tríceps',
      'Pernas',
      'Glúteos',
      'Abdômen',
      'Cardio',
    ]);
  });

  it('mantém os badges citados no contrato da API', () => {
    const byKey = new Map(BADGES.map((b) => [b.key, b]));

    expect(byKey.get('IRON_ROUTINE')).toMatchObject({
      name: 'Fera da Rotina',
      category: 'CONSISTENCY',
      icon: 'fera-da-rotina',
      criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 12 },
    });
    expect(byKey.get('IRON_MEDAL')).toMatchObject({
      name: 'Medalha de Ferro',
      criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 16 },
    });
    expect(byKey.get('LEGEND_OF_STRENGTH')).toMatchObject({
      name: 'Lenda da Força',
      category: 'STRENGTH',
      icon: 'lenda-da-forca',
      criterion: { type: 'EXERCISE_LOAD', exerciseBadgeKey: 'DEADLIFT', loadKg: 200 },
    });
  });

  it('cobre as cinco famílias de critério e as três categorias', () => {
    expect(new Set(BADGES.map((b) => b.category))).toEqual(
      new Set(['CONSISTENCY', 'VOLUME', 'STRENGTH']),
    );
    expect(new Set(BADGES.map((b) => b.criterion.type))).toEqual(
      new Set([
        'SESSION_COUNT',
        'COMPLETED_WEEKS',
        'CONSECUTIVE_WEEKS',
        'TOTAL_VOLUME',
        'SESSION_VOLUME',
        'EXERCISE_LOAD',
      ]),
    );
  });

  it('usa limites positivos e só badges de força dependem de exercício', () => {
    for (const { key, category, criterion } of BADGES) {
      const limits = Object.values(criterion).filter((v): v is number => typeof v === 'number');
      expect(
        limits.every((v) => v > 0),
        key,
      ).toBe(true);
      expect(criterion.type === 'EXERCISE_LOAD', key).toBe(category === 'STRENGTH');
    }
  });

  it('dá um badge de força para cada exercício base mapeado', () => {
    const used = BADGES.flatMap((b) =>
      b.criterion.type === 'EXERCISE_LOAD' ? [b.criterion.exerciseBadgeKey] : [],
    );
    expect(new Set(used)).toEqual(new Set(STRENGTH_EXERCISE_KEYS));
  });

  it('tem ícones em kebab-case sem repetir', () => {
    const icons = BADGES.map((b) => b.icon);
    expect(duplicates(icons)).toEqual([]);
    expect(icons.filter((icon) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon))).toEqual([]);
  });

  it('traz os parâmetros de negócio do card com os valores da ERS', () => {
    expect(SYSTEM_SETTINGS_SEED).toMatchObject({
      weeklyGoalDays: 5,
      validDayMinCompletedSetsPercent: 50,
      validDayMinDurationMinutes: 15,
      sessionEditWindowHours: 24,
      inviteExpiresInDays: 7,
      lateSyncWindowDays: 7,
    });
  });
});
