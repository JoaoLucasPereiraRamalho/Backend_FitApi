/** Envelopes de resposta (Especificação da API, seção 2). */
export interface DataEnvelope<T> {
  data: T;
}

export interface PageInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PageEnvelope<T> {
  data: T[];
  page: PageInfo;
}

/**
 * Marca as páginas já montadas, para o interceptor não embrulhar de novo. É um símbolo,
 * então não aparece no JSON e não colide com um campo `data` de algum recurso.
 */
const ENVELOPED = Symbol('enveloped');

export function paged<T>(items: T[], page: PageInfo): PageEnvelope<T> {
  return Object.defineProperty({ data: items, page }, ENVELOPED, { value: true });
}

export function isEnveloped(value: unknown): boolean {
  return typeof value === 'object' && value !== null && ENVELOPED in value;
}
