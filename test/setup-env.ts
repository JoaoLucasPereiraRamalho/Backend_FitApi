// Variáveis de ambiente dos testes, aplicadas antes de qualquer import (vitest setupFiles).
// Valores reais nunca entram aqui.
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_URL: 'postgresql://fittrack:fittrack@localhost:5432/fittrack_test',
});
