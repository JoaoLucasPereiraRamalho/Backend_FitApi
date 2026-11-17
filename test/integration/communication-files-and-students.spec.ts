import 'dotenv/config';
import { FixedClock, UuidV7Generator } from '../../src/platform/clock-and-ids/index.js';
import { loadConfig } from '../../src/platform/config/index.js';
import { PrismaService } from '../../src/platform/database/index.js';

const NOW = new Date('2026-11-16T12:00:00Z');
const ids = new UuidV7Generator(new FixedClock(NOW));

describe('comunicação, arquivos e dados do aluno (PostgreSQL)', () => {
  let prisma: PrismaService;
  let trainer: string;
  let student: string;
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

  const createFile = (override: Record<string, unknown> = {}) => {
    const id = ids.next();
    return prisma.storedFile.create({
      data: {
        id,
        ownerId: trainer,
        purpose: 'STUDENT_DOCUMENT',
        storageKey: `test/${id}.pdf`,
        fileName: 'avaliacao.pdf',
        contentType: 'application/pdf',
        sizeBytes: 812_345,
        createdAt: NOW,
        ...override,
      },
    });
  };

  const createConversation = async () => {
    const link = await prisma.link.create({
      data: { id: ids.next(), trainerId: trainer, studentId: student, startedAt: NOW },
    });
    const conversation = await prisma.conversation.create({
      data: {
        id: ids.next(),
        linkId: link.id,
        trainerId: trainer,
        studentId: student,
        createdAt: NOW,
      },
    });
    return { link, conversation };
  };

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env));
    await prisma.onModuleInit();
    trainer = await createUser('TRAINER');
    student = await createUser('STUDENT');
  });

  afterAll(async () => {
    await prisma.conversation.deleteMany({ where: { trainerId: { in: users } } });
    await prisma.link.deleteMany({ where: { trainerId: { in: users } } });
    await prisma.anamnesisVersion.deleteMany({ where: { authorId: { in: users } } });
    await prisma.storedFile.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.onModuleDestroy();
  });

  describe('chat', () => {
    it('tem uma conversa por vínculo', async () => {
      const { link } = await createConversation();

      await expect(
        prisma.conversation.create({
          data: {
            id: ids.next(),
            linkId: link.id,
            trainerId: trainer,
            studentId: student,
            createdAt: NOW,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await prisma.link.update({
        where: { id: link.id },
        data: { status: 'ENDED', endedAt: NOW, endedBy: 'TRAINER' },
      });
    });

    it('aceita texto de até 2.000 caracteres ou anexo, e nada vazio', async () => {
      const { link, conversation } = await createConversation();
      const message = (override: Record<string, unknown>) =>
        prisma.message.create({
          data: {
            id: ids.next(),
            conversationId: conversation.id,
            senderId: student,
            sentAt: NOW,
            ...override,
          },
        });

      await message({ text: 'x'.repeat(2000) });
      await message({ attachmentFileId: (await createFile()).id });
      await expect(message({ text: 'x'.repeat(2001) })).rejects.toThrow(/messages_text_length/);
      await expect(message({})).rejects.toThrow(/messages_has_content/);
      await prisma.link.update({
        where: { id: link.id },
        data: { status: 'ENDED', endedAt: NOW, endedBy: 'TRAINER' },
      });
    });
  });

  describe('medidas e anamnese', () => {
    const measurement = (override: Record<string, unknown>) =>
      prisma.bodyMeasurement.create({
        data: {
          id: ids.next(),
          studentId: student,
          measuredAt: NOW,
          weightKg: 82.4,
          createdAt: NOW,
          ...override,
        },
      });

    it('grava a medida dentro das faixas e recusa fora delas', async () => {
      const saved = await measurement({ bodyFatPercent: 14.5, waistCm: 84 });
      expect(saved.weightKg.toString()).toBe('82.4');

      await expect(measurement({ weightKg: 19.9 })).rejects.toThrow(/body_measurements_weight/);
      await expect(measurement({ weightKg: 400.1 })).rejects.toThrow(/body_measurements_weight/);
      await expect(measurement({ bodyFatPercent: 71 })).rejects.toThrow(
        /body_measurements_body_fat/,
      );
    });

    it('guarda as versões da anamnese sem repetir o número', async () => {
      const anamnesis = await prisma.anamnesis.create({
        data: { id: ids.next(), studentId: student, createdAt: NOW, updatedAt: NOW },
      });
      const version = (number: number, authorId: string) =>
        prisma.anamnesisVersion.create({
          data: {
            id: ids.next(),
            anamnesisId: anamnesis.id,
            number,
            content: { objective: { goal: 'Hipertrofia' } },
            authorId,
            createdAt: NOW,
          },
        });

      await version(1, student);
      await version(2, trainer);
      await expect(version(2, student)).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.anamnesis.create({
          data: { id: ids.next(), studentId: student, createdAt: NOW, updatedAt: NOW },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('arquivos', () => {
    it('limita a 10 MB e exige data de confirmação quando o arquivo está pronto', async () => {
      await createFile({ sizeBytes: 10_485_760, status: 'READY', completedAt: NOW });

      await expect(createFile({ sizeBytes: 10_485_761 })).rejects.toThrow(/files_size/);
      await expect(createFile({ status: 'READY' })).rejects.toThrow(/files_ready_completed/);
    });

    it('anexa cada arquivo ao aluno uma única vez', async () => {
      const file = await createFile({ status: 'READY', completedAt: NOW });
      const attach = () =>
        prisma.studentAttachment.create({
          data: {
            id: ids.next(),
            fileId: file.id,
            studentId: student,
            trainerId: trainer,
            title: 'Avaliação física · outubro',
            shared: true,
            createdAt: NOW,
            updatedAt: NOW,
          },
        });

      await attach();
      await expect(attach()).rejects.toMatchObject({ code: 'P2002' });
    });
  });
});
