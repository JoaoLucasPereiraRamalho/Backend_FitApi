import { InvalidConfigError, loadConfig } from '../app-config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://fittrack:fittrack@localhost:5432/fittrack',
};

describe('loadConfig', () => {
  it('aplica valores padrão e monta a configuração tipada', () => {
    expect(loadConfig(validEnv)).toEqual({
      processRole: 'api',
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      databaseUrl: validEnv.DATABASE_URL,
    });
  });

  it('converte a porta vinda como texto', () => {
    expect(loadConfig({ ...validEnv, PORT: '8080' }).port).toBe(8080);
  });

  it('recusa variável ausente, citando o nome', () => {
    expect(() => loadConfig({})).toThrow(InvalidConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('recusa porta fora da faixa e ambiente desconhecido', () => {
    expect(() => loadConfig({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...validEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('recusa DATABASE_URL que não seja PostgreSQL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: 'não é url' })).toThrow(/DATABASE_URL/);
  });

  it('lista todos os problemas de uma vez', () => {
    expect(() => loadConfig({ PORT: '0' })).toThrow(
      /PORT[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*PORT/,
    );
  });
});
