import { Writable } from 'node:stream';
import { pino } from 'pino';
import { REDACTED_PATHS, REDACTION_CENSOR } from '../redaction.js';

function logOnce(payload: object): Record<string, unknown> {
  let written = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      written += chunk.toString();
      done();
    },
  });
  // Escrita síncrona: com um Writable comum o pino chama write() antes de retornar.
  pino({ redact: { paths: REDACTED_PATHS, censor: REDACTION_CENSOR } }, stream).info(payload);
  return JSON.parse(written) as Record<string, unknown>;
}

describe('campos sensíveis no log', () => {
  it('oculta senha, tokens e e-mail', () => {
    const log = logOnce({
      body: {
        email: 'carlos@exemplo.com',
        password: 'Senha1234',
        refreshToken: 'rt_9f2c',
        idToken: 'id-google',
      },
      user: { accessToken: 'eyJhbGciOi', passwordHash: '$argon2id$' },
    });
    expect(log.body).toEqual({
      email: REDACTION_CENSOR,
      password: REDACTION_CENSOR,
      refreshToken: REDACTION_CENSOR,
      idToken: REDACTION_CENSOR,
    });
    expect(log.user).toEqual({ accessToken: REDACTION_CENSOR, passwordHash: REDACTION_CENSOR });
  });

  it('oculta dados de saúde e texto de mensagem', () => {
    const log = logOnce({
      body: { weightKg: 82.4, bodyFatPercent: 14.5, text: 'Dor no ombro', anamnesis: {} },
    });
    expect(Object.values(log.body as object)).toEqual(Array(4).fill(REDACTION_CENSOR));
  });

  it('mantém os campos que não são sensíveis', () => {
    const log = logOnce({ body: { sessionId: '0193b000', rpe: 8 } });
    expect(log.body).toEqual({ sessionId: '0193b000', rpe: 8 });
  });
});
