import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';

// Regra 6 dos testes de arquitetura: só platform/clock-and-ids lê o relógio ou gera UUID.
// O teste grava um arquivo temporário em cada pasta e roda o ESLint do projeto sobre ele.
const ROOT = join(import.meta.dirname, '..', '..');
const FORBIDDEN = `import { randomUUID } from 'node:crypto';
export const a = new Date();
export const b = Date.now();
export const c = randomUUID();
`;

async function lintAt(relativeDir: string): Promise<string[]> {
  const file = join(ROOT, relativeDir, '__lint_probe__.ts');
  writeFileSync(file, FORBIDDEN);
  try {
    const [result] = await new ESLint({ cwd: ROOT }).lintFiles([file]);
    return (result?.messages ?? [])
      .filter((m) => m.ruleId === 'no-restricted-syntax' || m.ruleId === 'no-restricted-imports')
      .map((m) => m.message);
  } finally {
    rmSync(file, { force: true });
  }
}

describe('regra de lint de Clock e IdGenerator', () => {
  it('falha ao usar new Date(), Date.now() ou randomUUID() fora de platform/clock-and-ids', async () => {
    const messages = await lintAt('src/modules/identity');
    expect(messages).toEqual([
      expect.stringContaining("'randomUUID' import from 'node:crypto' is restricted"),
      expect.stringContaining('new Date()'),
      expect.stringContaining('Date.now()'),
      expect.stringContaining('randomUUID()'),
    ]);
  }, 60_000);

  it('permite o mesmo código dentro de platform/clock-and-ids', async () => {
    expect(await lintAt('src/platform/clock-and-ids')).toEqual([]);
  }, 60_000);
});
