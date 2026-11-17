/**
 * Catálogo de badges (ERS 5.4). IRON_ROUTINE, IRON_MEDAL e LEGEND_OF_STRENGTH seguem docs/API.md;
 * os demais são provisórios.
 * TODO(ers): conferir chaves, nomes e limites com a tabela da ERS 5.4 antes da Sprint 7.
 *
 * O critério é dado, não código: as funções de critério da gamificação (FT-45) leem o tipo e os
 * parâmetros daqui. Badge de força só vale para exercício base com o badgeKey indicado (RN10).
 */
export type BadgeCriterion =
  | { type: 'SESSION_COUNT'; sessions: number }
  | { type: 'COMPLETED_WEEKS'; weeks: number }
  | { type: 'CONSECUTIVE_WEEKS'; weeks: number }
  | { type: 'TOTAL_VOLUME'; volumeKg: number }
  | { type: 'SESSION_VOLUME'; volumeKg: number }
  | { type: 'EXERCISE_LOAD'; exerciseBadgeKey: StrengthExerciseKey; loadKg: number };

export type BadgeCategory = 'CONSISTENCY' | 'VOLUME' | 'STRENGTH';

export interface BadgeSeed {
  key: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string;
  criterion: BadgeCriterion;
}

/** badgeKey dos exercícios base de força; o seed de exercícios (Sprint 3) usa as mesmas chaves. */
export const STRENGTH_EXERCISE_KEYS = [
  'BENCH_PRESS',
  'SQUAT',
  'DEADLIFT',
  'OVERHEAD_PRESS',
] as const;
export type StrengthExerciseKey = (typeof STRENGTH_EXERCISE_KEYS)[number];

export const BADGES: readonly BadgeSeed[] = [
  // Primeiros passos
  {
    key: 'FIRST_WORKOUT',
    name: 'Primeiro Treino',
    description: 'Primeira sessão de treino finalizada.',
    category: 'CONSISTENCY',
    icon: 'primeiro-treino',
    criterion: { type: 'SESSION_COUNT', sessions: 1 },
  },
  {
    key: 'FIRST_WEEK',
    name: 'Primeira Semana',
    description: 'Primeira semana com a meta de treinos concluída.',
    category: 'CONSISTENCY',
    icon: 'primeira-semana',
    criterion: { type: 'COMPLETED_WEEKS', weeks: 1 },
  },
  {
    key: 'TEN_WORKOUTS',
    name: 'Dez Treinos',
    description: '10 sessões de treino finalizadas.',
    category: 'CONSISTENCY',
    icon: 'dez-treinos',
    criterion: { type: 'SESSION_COUNT', sessions: 10 },
  },

  // Marcos de sequência
  {
    key: 'STREAK_4',
    name: 'Embalado',
    description: '4 semanas concluídas consecutivas.',
    category: 'CONSISTENCY',
    icon: 'embalado',
    criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 4 },
  },
  {
    key: 'STREAK_8',
    name: 'Ritmo Firme',
    description: '8 semanas concluídas consecutivas.',
    category: 'CONSISTENCY',
    icon: 'ritmo-firme',
    criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 8 },
  },
  {
    key: 'IRON_ROUTINE',
    name: 'Fera da Rotina',
    description: '12 semanas concluídas consecutivas.',
    category: 'CONSISTENCY',
    icon: 'fera-da-rotina',
    criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 12 },
  },
  {
    key: 'IRON_MEDAL',
    name: 'Medalha de Ferro',
    description: '16 semanas concluídas consecutivas.',
    category: 'CONSISTENCY',
    icon: 'medalha-de-ferro',
    criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 16 },
  },
  {
    key: 'STREAK_26',
    name: 'Meio Ano Firme',
    description: '26 semanas concluídas consecutivas.',
    category: 'CONSISTENCY',
    icon: 'meio-ano-firme',
    criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 26 },
  },
  {
    key: 'STREAK_52',
    name: 'Um Ano Imparável',
    description: '52 semanas concluídas consecutivas.',
    category: 'CONSISTENCY',
    icon: 'um-ano-imparavel',
    criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 52 },
  },

  // Constância (total acumulado, sem exigir sequência)
  {
    key: 'WEEKS_25',
    name: 'Veterano',
    description: '25 semanas concluídas no total.',
    category: 'CONSISTENCY',
    icon: 'veterano',
    criterion: { type: 'COMPLETED_WEEKS', weeks: 25 },
  },
  {
    key: 'WORKOUTS_100',
    name: 'Centenário',
    description: '100 sessões de treino finalizadas.',
    category: 'CONSISTENCY',
    icon: 'centenario',
    criterion: { type: 'SESSION_COUNT', sessions: 100 },
  },

  // Volume
  {
    key: 'HEAVY_SESSION',
    name: 'Sessão Pesada',
    description: '10 toneladas levantadas numa única sessão.',
    category: 'VOLUME',
    icon: 'sessao-pesada',
    criterion: { type: 'SESSION_VOLUME', volumeKg: 10_000 },
  },
  {
    key: 'VOLUME_100T',
    name: '100 Toneladas',
    description: '100 toneladas levantadas no total.',
    category: 'VOLUME',
    icon: 'cem-toneladas',
    criterion: { type: 'TOTAL_VOLUME', volumeKg: 100_000 },
  },
  {
    key: 'VOLUME_1000T',
    name: 'Mil Toneladas',
    description: '1.000 toneladas levantadas no total.',
    category: 'VOLUME',
    icon: 'mil-toneladas',
    criterion: { type: 'TOTAL_VOLUME', volumeKg: 1_000_000 },
  },

  // Força (RN10)
  {
    key: 'BENCH_100',
    name: 'Clube dos 100',
    description: 'Série de supino reto com 100 kg ou mais.',
    category: 'STRENGTH',
    icon: 'clube-dos-100',
    criterion: { type: 'EXERCISE_LOAD', exerciseBadgeKey: 'BENCH_PRESS', loadKg: 100 },
  },
  {
    key: 'SQUAT_140',
    name: 'Base de Aço',
    description: 'Série de agachamento livre com 140 kg ou mais.',
    category: 'STRENGTH',
    icon: 'base-de-aco',
    criterion: { type: 'EXERCISE_LOAD', exerciseBadgeKey: 'SQUAT', loadKg: 140 },
  },
  {
    key: 'LEGEND_OF_STRENGTH',
    name: 'Lenda da Força',
    description: 'Série de levantamento terra com 200 kg ou mais.',
    category: 'STRENGTH',
    icon: 'lenda-da-forca',
    criterion: { type: 'EXERCISE_LOAD', exerciseBadgeKey: 'DEADLIFT', loadKg: 200 },
  },
  {
    key: 'PRESS_60',
    name: 'Ombros de Ferro',
    description: 'Série de desenvolvimento com 60 kg ou mais.',
    category: 'STRENGTH',
    icon: 'ombros-de-ferro',
    criterion: { type: 'EXERCISE_LOAD', exerciseBadgeKey: 'OVERHEAD_PRESS', loadKg: 60 },
  },
];
