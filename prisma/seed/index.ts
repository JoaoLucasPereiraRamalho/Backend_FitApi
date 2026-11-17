import 'dotenv/config';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { createPgAdapter } from '../../src/platform/database/pg-adapter.js';
import { runSeed } from './run.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não definida');

  const prisma = new PrismaClient({ adapter: createPgAdapter(connectionString) });
  const now = new Date(); // script de seed fica fora do código de regra; o Clock não se aplica aqui
  try {
    const summary = await runSeed(prisma, now);
    console.log(
      `Seed: ${summary.muscleGroups} grupamentos, ${summary.equipment} equipamentos, ` +
        `${summary.badges} badges, ${summary.systemSettings} parâmetros de sistema.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
