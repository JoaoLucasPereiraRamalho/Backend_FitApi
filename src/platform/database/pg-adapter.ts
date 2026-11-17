import { PrismaPg } from '@prisma/adapter-pg';

/**
 * O adapter do Prisma envia instantes como texto em UTC sem offset e, na leitura, troca o offset
 * devolvido por +00:00. Isso só fica correto com a sessão em UTC; com o fuso padrão do servidor
 * (ex.: America/Sao_Paulo) todo timestamptz seria gravado e lido deslocado.
 */
export function createPgAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString, options: '-c TimeZone=UTC' });
}
