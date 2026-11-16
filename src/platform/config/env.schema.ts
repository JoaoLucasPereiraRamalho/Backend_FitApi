import { z } from 'zod';

/**
 * Todas as variáveis de ambiente, validadas uma vez no início do processo.
 * Valor ausente ou inválido impede o processo de subir. Variável nova entra aqui
 * junto com o card que passa a usá-la.
 */
export const envSchema = z.object({
  PROCESS_ROLE: z.enum(['api', 'worker']).default('api'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;
