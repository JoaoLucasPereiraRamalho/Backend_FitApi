import type { IdGenerator } from '../clock-and-ids/index.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Reaproveita o X-Request-Id do cliente quando é seguro; senão gera um.
 * O mesmo valor vai no log, no cabeçalho da resposta e em error.traceId.
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
  ids: IdGenerator,
): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  return candidate && VALID_REQUEST_ID.test(candidate) ? candidate : ids.next();
}
