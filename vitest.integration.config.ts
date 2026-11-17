import { defineConfig } from 'vitest/config';

// Testes contra um PostgreSQL de verdade, com as migrações já aplicadas.
// A base vem de DATABASE_URL (no CI, o serviço postgres do job de integração).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/integration/**/*.spec.ts'],
    fileParallelism: false,
  },
});
