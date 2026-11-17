import 'dotenv/config';
import { FixedClock, UuidV7Generator } from '../../src/platform/clock-and-ids/index.js';
import { loadConfig } from '../../src/platform/config/index.js';
import { PrismaService } from '../../src/platform/database/index.js';

const NOW = new Date('2026-11-16T12:00:00Z');
const ids = new UuidV7Generator(new FixedClock(NOW));
const MUSCLE = 'TEST_CHEST';
const EQUIPMENT = 'TEST_BARBELL';

describe('biblioteca e prescrição (PostgreSQL)', () => {
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

  const createExercise = (
    name: string,
    extra: { ownerId?: string; badgeKey?: string; deletedAt?: Date } = {},
  ) =>
    prisma.exercise.create({
      data: {
        id: ids.next(),
        name,
        muscleGroupKey: MUSCLE,
        equipmentKey: EQUIPMENT,
        instructions: [],
        createdAt: NOW,
        updatedAt: NOW,
        ...extra,
      },
    });

  const createMesocycle = (
    ownerId: string,
    studentId: string,
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' = 'DRAFT',
  ) =>
    prisma.mesocycle.create({
      data: {
        id: ids.next(),
        ownerId,
        studentId,
        name: 'Hipertrofia 8 semanas',
        status,
        createdAt: NOW,
        updatedAt: NOW,
        activatedAt: status === 'DRAFT' ? null : NOW,
        archivedAt: status === 'ARCHIVED' ? NOW : null,
      },
    });

  const createSession = (mesocycleId: string, position = 1) =>
    prisma.prescribedSession.create({
      data: { id: ids.next(), mesocycleId, name: 'Treino A', position },
    });

  const item = (sessionId: string, exerciseId: string, position = 1) => ({
    id: ids.next(),
    sessionId,
    exerciseId,
    position,
    sets: 4,
    repsMin: 8,
    repsMax: 12,
  });

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env));
    await prisma.onModuleInit();
    await prisma.muscleGroup.create({ data: { key: MUSCLE, label: 'Peito', sortOrder: 1 } });
    await prisma.equipment.create({ data: { key: EQUIPMENT, label: 'Barra', sortOrder: 1 } });
  });

  afterAll(async () => {
    await prisma.template.deleteMany({ where: { trainerId: { in: users } } });
    await prisma.mesocycle.deleteMany({ where: { studentId: { in: users } } });
    await prisma.exercise.deleteMany({ where: { muscleGroupKey: MUSCLE } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.muscleGroup.delete({ where: { key: MUSCLE } });
    await prisma.equipment.delete({ where: { key: EQUIPMENT } });
    await prisma.onModuleDestroy();
  });

  describe('exercícios', () => {
    it('recusa nome repetido do mesmo dono, sem diferenciar maiúsculas', async () => {
      const trainer = await createUser('TRAINER');
      await createExercise('Supino inclinado', { ownerId: trainer });

      await expect(createExercise('SUPINO INCLINADO', { ownerId: trainer })).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('aceita o mesmo nome para outro dono, na base e depois de excluir', async () => {
      const [trainerA, trainerB] = await Promise.all([
        createUser('TRAINER'),
        createUser('TRAINER'),
      ]);
      await createExercise('Remada curvada', { ownerId: trainerA, deletedAt: NOW });
      await createExercise('Remada curvada', { ownerId: trainerA });
      await createExercise('Remada curvada', { ownerId: trainerB });
      await createExercise('Remada curvada');

      expect(await prisma.exercise.count({ where: { name: 'Remada curvada' } })).toBe(4);
    });

    it('só permite badgeKey em exercício base', async () => {
      const trainer = await createUser('TRAINER');
      await createExercise('Supino reto base', { badgeKey: 'TEST_BENCH_PRESS' });

      await expect(
        createExercise('Supino reto meu', { ownerId: trainer, badgeKey: 'TEST_OTHER' }),
      ).rejects.toThrow(/exercises_badge_key_only_base/);
    });

    it('não repete alternativa na base nem para o mesmo treinador, e não aceita a própria', async () => {
      const trainer = await createUser('TRAINER');
      const [main, alt] = await Promise.all([
        createExercise('Agachamento livre'),
        createExercise('Agachamento no smith'),
      ]);
      const alternative = (approvedById: string | null) =>
        prisma.exerciseAlternative.create({
          data: {
            id: ids.next(),
            exerciseId: main.id,
            alternativeId: alt.id,
            approvedById,
            createdAt: NOW,
          },
        });

      await alternative(null);
      await alternative(trainer);
      await expect(alternative(null)).rejects.toMatchObject({ code: 'P2002' });
      await expect(alternative(trainer)).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.exerciseAlternative.create({
          data: { id: ids.next(), exerciseId: main.id, alternativeId: main.id, createdAt: NOW },
        }),
      ).rejects.toThrow(/exercise_alternatives_not_self/);
    });
  });

  describe('mesociclos', () => {
    it('recusa uma segunda ficha ativa para o mesmo aluno', async () => {
      const [trainer, student] = await Promise.all([createUser('TRAINER'), createUser('STUDENT')]);
      await createMesocycle(trainer, student, 'ACTIVE');
      await createMesocycle(trainer, student, 'ARCHIVED');
      await createMesocycle(trainer, student, 'DRAFT');

      await expect(createMesocycle(trainer, student, 'ACTIVE')).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('exige data de ativação na ficha ativa e de arquivamento na arquivada', async () => {
      const [trainer, student] = await Promise.all([createUser('TRAINER'), createUser('STUDENT')]);
      const base = {
        ownerId: trainer,
        studentId: student,
        name: 'Ficha',
        createdAt: NOW,
        updatedAt: NOW,
      };

      await expect(
        prisma.mesocycle.create({ data: { id: ids.next(), ...base, status: 'ACTIVE' } }),
      ).rejects.toThrow(/mesocycles_status_dates/);
      await expect(
        prisma.mesocycle.create({ data: { id: ids.next(), ...base, status: 'ARCHIVED' } }),
      ).rejects.toThrow(/mesocycles_status_dates/);
    });

    it('recusa período com fim antes do início', async () => {
      const [trainer, student] = await Promise.all([createUser('TRAINER'), createUser('STUDENT')]);

      await expect(
        prisma.mesocycle.create({
          data: {
            id: ids.next(),
            ownerId: trainer,
            studentId: student,
            name: 'Ficha',
            startsOn: new Date('2026-12-01'),
            endsOn: new Date('2026-11-01'),
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      ).rejects.toThrow(/mesocycles_period/);
    });
  });

  describe('itens prescritos', () => {
    let sessionId: string;
    let exerciseId: string;

    beforeAll(async () => {
      const [trainer, student] = await Promise.all([createUser('TRAINER'), createUser('STUDENT')]);
      const mesocycle = await createMesocycle(trainer, student);
      sessionId = (await createSession(mesocycle.id)).id;
      exerciseId = (await createExercise('Crucifixo')).id;
    });

    it('grava um item válido com o descanso padrão de 60 s', async () => {
      const saved = await prisma.prescribedItem.create({
        data: { ...item(sessionId, exerciseId, 1), cadence: '3010', note: 'Controle a descida.' },
      });
      expect(saved.restSeconds).toBe(60);
    });

    it.each([
      ['séries acima de 20', { sets: 21 }, 'prescribed_items_sets'],
      ['séries zero', { sets: 0 }, 'prescribed_items_sets'],
      ['repsMin maior que repsMax', { repsMin: 12, repsMax: 8 }, 'prescribed_items_reps'],
      ['descanso acima de 600 s', { restSeconds: 601 }, 'prescribed_items_rest'],
      ['cadência fora do formato', { cadence: '30A0' }, 'prescribed_items_cadence'],
      ['observação acima de 300 caracteres', { note: 'x'.repeat(301) }, 'prescribed_items_note'],
      ['grupo sem tipo', { groupKey: 'g1' }, 'prescribed_items_group'],
    ])('recusa %s', async (_case, override, constraint) => {
      await expect(
        prisma.prescribedItem.create({
          data: { ...item(sessionId, exerciseId, 50), ...override },
        }),
      ).rejects.toThrow(new RegExp(constraint));
    });

    it('não deixa excluir de fato um exercício que está em uma ficha', async () => {
      await expect(prisma.exercise.delete({ where: { id: exerciseId } })).rejects.toThrow();
      expect(await prisma.exercise.findUnique({ where: { id: exerciseId } })).not.toBeNull();
    });
  });

  it('guarda o template como cópia independente da ficha', async () => {
    const trainer = await createUser('TRAINER');
    const structure = { sessions: [{ name: 'Treino A', order: 1, items: [] }] };

    const template = await prisma.template.create({
      data: {
        id: ids.next(),
        trainerId: trainer,
        name: 'Base hipertrofia',
        structure,
        createdAt: NOW,
        updatedAt: NOW,
      },
    });

    expect(template.structure).toEqual(structure);
  });
});
