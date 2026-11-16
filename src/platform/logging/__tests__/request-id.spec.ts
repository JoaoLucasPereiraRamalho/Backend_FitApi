import { SequentialIdGenerator } from '../../clock-and-ids/index.js';
import { resolveRequestId } from '../request-id.js';

describe('resolveRequestId', () => {
  it('reaproveita um X-Request-Id válido do cliente', () => {
    expect(resolveRequestId('abc-12345678', new SequentialIdGenerator(['gerado']))).toBe(
      'abc-12345678',
    );
  });

  it('usa o primeiro valor quando o cabeçalho vem repetido', () => {
    expect(resolveRequestId(['abc-12345678', 'outro-1234'], new SequentialIdGenerator([]))).toBe(
      'abc-12345678',
    );
  });

  it('gera um novo quando o cabeçalho falta ou é inseguro', () => {
    const ids = new SequentialIdGenerator(['id-gerado-1', 'id-gerado-2', 'id-gerado-3']);
    expect(resolveRequestId(undefined, ids)).toBe('id-gerado-1');
    expect(resolveRequestId('x\n{"forjado":true}', ids)).toBe('id-gerado-2');
    expect(resolveRequestId('curto', ids)).toBe('id-gerado-3');
  });
});
