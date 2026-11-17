import 'dotenv/config';
import { FixedClock, UuidV7Generator } from '../../src/platform/clock-and-ids/index.js';
import { loadConfig } from '../../src/platform/config/index.js';
import { PrismaService } from '../../src/platform/database/index.js';

const NOW = new Date('2026-11-16T12:00:00Z');
const ids = new UuidV7Generator(new FixedClock(NOW));

describe('vínculos (PostgreSQL)', () => {
  let prisma: PrismaService;
  const users: string[] = [];

  const createUser = async (role: 'TRAINER' | 'STUDENT') => {
    const id = ids.next();
    users.push(id);
    await prisma.user.create({
      data: {
        id,
        name: `Teste ${role}`,
        email: `${id}@teste.local`,
        role,
        timezone: 'America/Sao_Paulo',
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    return id;
  };

  const activeLink = (trainerId: string, studentId: string) =>
    prisma.link.create({ data: { id: ids.next(), trainerId, studentId, startedAt: NOW } });

  const endLink = (id: string) =>
    prisma.link.update({
      where: { id },
      data: { status: 'ENDED', endedAt: NOW, endedBy: 'STUDENT' },
    });

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env));
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.link.deleteMany({ where: { studentId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.onModuleDestroy();
  });

  it('recusa um segundo vínculo ativo para o mesmo aluno', async () => {
    const [trainerA, trainerB, student] = await Promise.all([
      createUser('TRAINER'),
      createUser('TRAINER'),
      createUser('STUDENT'),
    ]);
    await activeLink(trainerA, student);

    await expect(activeLink(trainerB, student)).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.link.count({ where: { studentId: student, status: 'ACTIVE' } })).toBe(1);
  });

  it('aceita um novo vínculo depois de encerrar o anterior e mantém o histórico', async () => {
    const [trainerA, trainerB, student] = await Promise.all([
      createUser('TRAINER'),
      createUser('TRAINER'),
      createUser('STUDENT'),
    ]);
    const first = await activeLink(trainerA, student);
    await endLink(first.id);
    const second = await activeLink(trainerB, student);
    await endLink(second.id);
    await activeLink(trainerA, student);

    const links = await prisma.link.findMany({ where: { studentId: student } });
    expect(links.map((l) => l.status).sort()).toEqual(['ACTIVE', 'ENDED', 'ENDED']);
  });

  it('permite que um treinador tenha vários alunos ativos', async () => {
    const [trainer, studentA, studentB] = await Promise.all([
      createUser('TRAINER'),
      createUser('STUDENT'),
      createUser('STUDENT'),
    ]);
    await activeLink(trainer, studentA);
    await activeLink(trainer, studentB);

    expect(await prisma.link.count({ where: { trainerId: trainer, status: 'ACTIVE' } })).toBe(2);
  });

  it('exige data e autor ao encerrar e recusa vínculo do usuário com ele mesmo', async () => {
    const [trainer, student] = await Promise.all([createUser('TRAINER'), createUser('STUDENT')]);
    const link = await activeLink(trainer, student);

    await expect(
      prisma.link.update({ where: { id: link.id }, data: { status: 'ENDED' } }),
    ).rejects.toThrow(/links_ended_consistency/);
    await expect(activeLink(trainer, trainer)).rejects.toThrow(/links_trainer_is_not_student/);
  });
});
