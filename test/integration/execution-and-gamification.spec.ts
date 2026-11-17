import 'dotenv/config';
import { FixedClock, UuidV7Generator } from '../../src/platform/clock-and-ids/index.js';
import { loadConfig } from '../../src/platform/config/index.js';
import { PrismaService } from '../../src/platform/database/index.js';

const NOW = new Date('2026-11-16T12:00:00Z');
const ids = new UuidV7Generator(new FixedClock(NOW));
const MUSCLE = 'TEST_EXEC_LEGS';
const EQUIPMENT = 'TEST_EXEC_BARBELL';
const BADGE = 'TEST_EXEC_FIRST_WEEK';

describe('execução e gamificação (PostgreSQL)', () => {
  let prisma: PrismaService;
  let trainerId: string;
  let exerciseId: string;
  let prescribedSessionId: string;
  let prescribedItemId: string;
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

  const startSession = (studentId: string) =>
    prisma.executedSession.create({
      data: {
        id: ids.next(),
        studentId,
        prescribedSessionId,
        startedAt: NOW,
        lastActivityAt: NOW,
        timezone: 'America/Sao_Paulo',
        localDate: new Date('2026-11-16'),
        createdAt: NOW,
        updatedAt: NOW,
      },
    });

  const finished = {
    status: 'FINISHED' as const,
    finishedAt: new Date('2026-11-16T13:00:00Z'),
    closedBy: 'STUDENT' as const,
    rpe: 8,
    durationSeconds: 3600,
    volumeKg: 5200,
    completedSets: 18,
    prescribedSets: 20,
    countedForGamification: true,
  };

  const set = (sessionId: string, override: Record<string, unknown> = {}) => ({
    id: ids.next(),
    sessionId,
    prescribedItemId,
    exerciseId,
    setNumber: 1,
    loadKg: 87.5,
    reps: 10,
    completedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...override,
  });

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env));
    await prisma.onModuleInit();
    await prisma.muscleGroup.create({ data: { key: MUSCLE, label: 'Pernas', sortOrder: 1 } });
    await prisma.equipment.create({ data: { key: EQUIPMENT, label: 'Barra', sortOrder: 1 } });
    await prisma.badge.create({
      data: {
        key: BADGE,
        name: 'Primeira semana',
        description: 'Conclua a primeira semana.',
        category: 'CONSISTENCY',
        icon: 'primeira-semana',
        criterion: { type: 'CONSECUTIVE_WEEKS', weeks: 1 },
        sortOrder: 1,
      },
    });

    trainerId = await createUser('TRAINER');
    const placeholderStudent = await createUser('STUDENT');
    exerciseId = (
      await prisma.exercise.create({
        data: {
          id: ids.next(),
          name: 'Agachamento livre',
          muscleGroupKey: MUSCLE,
          equipmentKey: EQUIPMENT,
          instructions: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      })
    ).id;
    const mesocycle = await prisma.mesocycle.create({
      data: {
        id: ids.next(),
        ownerId: trainerId,
        studentId: placeholderStudent,
        name: 'Ficha',
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    prescribedSessionId = (
      await prisma.prescribedSession.create({
        data: { id: ids.next(), mesocycleId: mesocycle.id, name: 'Treino A', position: 1 },
      })
    ).id;
    prescribedItemId = (
      await prisma.prescribedItem.create({
        data: {
          id: ids.next(),
          sessionId: prescribedSessionId,
          exerciseId,
          position: 1,
          sets: 4,
          repsMin: 8,
          repsMax: 12,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.studentBadge.deleteMany({ where: { badgeKey: BADGE } });
    await prisma.executedSession.deleteMany({ where: { studentId: { in: users } } });
    await prisma.mesocycle.deleteMany({ where: { ownerId: trainerId } });
    await prisma.exercise.deleteMany({ where: { muscleGroupKey: MUSCLE } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.badge.delete({ where: { key: BADGE } });
    await prisma.muscleGroup.delete({ where: { key: MUSCLE } });
    await prisma.equipment.delete({ where: { key: EQUIPMENT } });
    await prisma.onModuleDestroy();
  });

  describe('sessões executadas', () => {
    it('recusa uma segunda sessão em andamento para o mesmo aluno', async () => {
      const student = await createUser('STUDENT');
      await startSession(student);

      await expect(startSession(student)).rejects.toMatchObject({ code: 'P2002' });
    });

    it('aceita nova sessão depois de finalizar ou excluir a anterior', async () => {
      const student = await createUser('STUDENT');
      const first = await startSession(student);
      await prisma.executedSession.update({ where: { id: first.id }, data: finished });
      const second = await startSession(student);
      await prisma.executedSession.update({ where: { id: second.id }, data: { deletedAt: NOW } });
      await startSession(student);

      expect(await prisma.executedSession.count({ where: { studentId: student } })).toBe(3);
    });

    it('exige a sessão prescrita (RN05)', async () => {
      const student = await createUser('STUDENT');

      await expect(
        prisma.executedSession.create({
          data: {
            id: ids.next(),
            studentId: student,
            prescribedSessionId: ids.next(),
            startedAt: NOW,
            lastActivityAt: NOW,
            timezone: 'America/Sao_Paulo',
            localDate: new Date('2026-11-16'),
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('não finaliza sem os totais calculados e recusa RPE fora de 1 a 10', async () => {
      const student = await createUser('STUDENT');
      const session = await startSession(student);

      await expect(
        prisma.executedSession.update({
          where: { id: session.id },
          data: { status: 'FINISHED', finishedAt: NOW, closedBy: 'STUDENT' },
        }),
      ).rejects.toThrow(/executed_sessions_status_fields/);
      await expect(
        prisma.executedSession.update({
          where: { id: session.id },
          data: { ...finished, rpe: 11 },
        }),
      ).rejects.toThrow(/executed_sessions_rpe/);
    });
  });

  describe('séries executadas', () => {
    let sessionId: string;

    beforeAll(async () => {
      sessionId = (await startSession(await createUser('STUDENT'))).id;
    });

    it('grava a carga em kg com duas casas decimais', async () => {
      const saved = await prisma.executedSet.create({ data: set(sessionId, { loadKg: 87.25 }) });
      expect(saved.loadKg.toString()).toBe('87.25');
    });

    it.each([
      ['carga negativa', { loadKg: -1 }, 'executed_sets_load'],
      ['carga acima de 1000 kg', { loadKg: 1000.5 }, 'executed_sets_load'],
      ['repetições zero', { reps: 0 }, 'executed_sets_reps'],
      ['repetições acima de 100', { reps: 101 }, 'executed_sets_reps'],
      ['número da série zero', { setNumber: 0 }, 'executed_sets_set_number'],
    ])('recusa %s', async (_case, override, constraint) => {
      await expect(prisma.executedSet.create({ data: set(sessionId, override) })).rejects.toThrow(
        new RegExp(constraint),
      );
    });

    it('guarda uma confirmação de carga por série', async () => {
      const student = await createUser('STUDENT');
      const saved = await prisma.executedSet.create({ data: set(sessionId, { loadKg: 210 }) });
      const confirmation = () =>
        prisma.loadConfirmation.create({
          data: {
            id: ids.next(),
            studentId: student,
            setId: saved.id,
            exerciseId,
            loadKg: 210,
            previousBestKg: 130,
            createdAt: NOW,
          },
        });

      await confirmation();
      await expect(confirmation()).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  it('não grava a mesma mutação duas vezes (clientMutationId)', async () => {
    const student = await createUser('STUDENT');
    const mutation = {
      clientMutationId: ids.next(),
      userId: student,
      deviceId: ids.next(),
      type: 'SET_UPSERT' as const,
      result: 'APPLIED' as const,
      occurredAt: NOW,
      receivedAt: NOW,
    };

    await prisma.syncedMutation.create({ data: mutation });
    await expect(prisma.syncedMutation.create({ data: mutation })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  describe('gamificação', () => {
    const week = (studentId: string, weekStart: string) =>
      prisma.weekProgress.create({
        data: {
          id: ids.next(),
          studentId,
          weekStart: new Date(weekStart),
          timezone: 'America/Sao_Paulo',
          goalDays: 5,
          updatedAt: NOW,
        },
      });

    it('tem uma semana por aluno e início da semana, sempre numa segunda-feira', async () => {
      const student = await createUser('STUDENT');
      await week(student, '2026-11-16');
      await week(student, '2026-11-23');

      await expect(week(student, '2026-11-16')).rejects.toMatchObject({ code: 'P2002' });
      await expect(week(student, '2026-11-18')).rejects.toThrow(/week_progress_starts_monday/);
    });

    it('concede cada badge uma única vez por aluno, com a origem preenchida', async () => {
      const student = await createUser('STUDENT');
      const award = (originWeekStart: Date | null) =>
        prisma.studentBadge.create({
          data: {
            id: ids.next(),
            studentId: student,
            badgeKey: BADGE,
            unlockedAt: NOW,
            originType: 'WEEK',
            originWeekStart,
          },
        });

      await expect(award(null)).rejects.toThrow(/student_badges_origin/);
      await award(new Date('2026-11-16'));
      await expect(award(new Date('2026-11-23'))).rejects.toMatchObject({ code: 'P2002' });
    });
  });
});
