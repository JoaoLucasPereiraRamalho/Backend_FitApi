// ConfigModule.forRoot valida o ambiente quando o módulo raiz é carregado, então um
// processo sem DATABASE_URL não chega a criar a aplicação.
describe('subida do processo sem configuração válida', () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    process.env.DATABASE_URL = original;
  });

  it('o processo api não sobe sem DATABASE_URL', async () => {
    const loading = import('../../src/app.module.js');
    // vi.resetModules recarrega a classe, então a checagem é pelo nome, não por instanceof.
    await expect(loading).rejects.toMatchObject({ name: 'InvalidConfigError' });
    await expect(loading).rejects.toThrow(/DATABASE_URL/);
  });

  it('o processo worker não sobe sem DATABASE_URL', async () => {
    await expect(import('../../src/worker.module.js')).rejects.toThrow(/DATABASE_URL/);
  });

  it('o processo api não sobe com PORT inválida', async () => {
    process.env.DATABASE_URL = original;
    process.env.PORT = 'abc';
    try {
      await expect(import('../../src/app.module.js')).rejects.toThrow(/PORT/);
    } finally {
      delete process.env.PORT;
    }
  });
});
