/**
 * Valores iniciais dos parâmetros de negócio (ERS 5.1 e 5.4), lidos de system_settings e expostos
 * em GET /config. O seed só cria a chave que falta: um valor já ajustado na base não é sobrescrito,
 * e alterá-lo não exige deploy.
 */
export const SYSTEM_SETTINGS_SEED = {
  weeklyGoalDays: 5,
  validDayMinCompletedSetsPercent: 50,
  validDayMinDurationMinutes: 15,
  lateSyncWindowDays: 7,
  sessionEditWindowHours: 24,
  inviteExpiresInDays: 7,
  sessionAutoCloseInactivityHours: 4,
  suspiciousLoadIncreasePercent: 50,
  minAppVersion: '1.0.0',
} as const satisfies Record<string, number | string>;
