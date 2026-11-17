/**
 * Catálogos da biblioteca. A chave é estável (clientes e filtros usam); o rótulo pode ser corrigido
 * aqui e o seed atualiza a base.
 */
export interface CatalogEntry {
  key: string;
  label: string;
}

export const MUSCLE_GROUPS: readonly CatalogEntry[] = [
  { key: 'CHEST', label: 'Peito' },
  { key: 'BACK', label: 'Costas' },
  { key: 'SHOULDERS', label: 'Ombros' },
  { key: 'BICEPS', label: 'Bíceps' },
  { key: 'TRICEPS', label: 'Tríceps' },
  { key: 'LEGS', label: 'Pernas' },
  { key: 'GLUTES', label: 'Glúteos' },
  { key: 'ABS', label: 'Abdômen' },
  { key: 'CARDIO', label: 'Cardio' },
];

export const EQUIPMENT: readonly CatalogEntry[] = [
  { key: 'BARBELL', label: 'Barra' },
  { key: 'DUMBBELL', label: 'Halteres' },
  { key: 'MACHINE', label: 'Máquina' },
  { key: 'CABLE', label: 'Polia' },
  { key: 'SMITH', label: 'Smith' },
  { key: 'BODYWEIGHT', label: 'Peso corporal' },
  { key: 'KETTLEBELL', label: 'Kettlebell' },
  { key: 'RESISTANCE_BAND', label: 'Elástico' },
  { key: 'BENCH', label: 'Banco' },
  { key: 'OTHER', label: 'Outro' },
];
