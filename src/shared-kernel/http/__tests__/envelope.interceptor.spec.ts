import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { paged } from '../envelope.js';
import { EnvelopeInterceptor } from '../envelope.interceptor.js';

function intercept(body: unknown): Promise<unknown> {
  const next: CallHandler = { handle: () => of(body) };
  return lastValueFrom(new EnvelopeInterceptor().intercept({} as ExecutionContext, next));
}

describe('EnvelopeInterceptor', () => {
  it('embrulha objeto único em { data }', async () => {
    expect(await intercept({ id: '0193', name: 'Carlos' })).toEqual({
      data: { id: '0193', name: 'Carlos' },
    });
  });

  it('embrulha listas sem paginação e valores nulos', async () => {
    expect(await intercept([1, 2])).toEqual({ data: [1, 2] });
    expect(await intercept(null)).toEqual({ data: null });
  });

  it('não embrulha de novo uma página por cursor', async () => {
    const page = paged([{ id: 'a' }], { limit: 20, nextCursor: null, hasMore: false });
    expect(await intercept(page)).toBe(page);
  });

  it('embrulha recurso que tem um campo chamado data', async () => {
    expect(await intercept({ data: 'campo do recurso' })).toEqual({
      data: { data: 'campo do recurso' },
    });
  });

  it('mantém sem corpo as respostas 204', async () => {
    expect(await intercept(undefined)).toBeUndefined();
  });
});
