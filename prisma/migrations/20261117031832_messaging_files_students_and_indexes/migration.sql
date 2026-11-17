-- CreateEnum
CREATE TYPE "HealthDataResource" AS ENUM ('ANAMNESIS', 'BODY_MEASUREMENTS', 'STUDENT_ATTACHMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MESOCYCLE', 'TRAINER_MESSAGE', 'WORKOUT_REMINDER', 'WEEK_COMPLETED', 'STREAK_AT_RISK', 'BADGE_UNLOCKED', 'STREAK_BROKEN', 'STUDENT_MESSAGE', 'STUDENT_HIGH_RPE', 'STUDENT_PAIN_REPORTED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('EXERCISE_MEDIA', 'STUDENT_DOCUMENT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY');

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "media_file_id" UUID;

-- CreateTable
CREATE TABLE "trainer_notes" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trainer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_measurements" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "measured_at" TIMESTAMPTZ NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "body_fat_percent" DECIMAL(4,1),
    "waist_cm" DECIMAL(5,1),
    "arm_cm" DECIMAL(5,1),
    "thigh_cm" DECIMAL(5,1),
    "created_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamneses" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anamneses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_versions" (
    "id" UUID NOT NULL,
    "anamnesis_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anamnesis_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_data_access_log" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "reader_id" UUID NOT NULL,
    "resource" "HealthDataResource" NOT NULL,
    "resource_id" UUID,
    "read_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "health_data_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "last_message_at" TIMESTAMPTZ,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "text" TEXT,
    "attachment_file_id" UUID,
    "sent_at" TIMESTAMPTZ NOT NULL,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "target" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attachments" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "student_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_notes_trainer_id_student_id_updated_at_idx" ON "trainer_notes"("trainer_id", "student_id", "updated_at");

-- CreateIndex
CREATE INDEX "body_measurements_student_id_measured_at_idx" ON "body_measurements"("student_id", "measured_at");

-- CreateIndex
CREATE UNIQUE INDEX "anamneses_student_id_key" ON "anamneses"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_versions_anamnesis_id_number_key" ON "anamnesis_versions"("anamnesis_id", "number");

-- CreateIndex
CREATE INDEX "health_data_access_log_student_id_read_at_idx" ON "health_data_access_log"("student_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_link_id_key" ON "conversations"("link_id");

-- CreateIndex
CREATE INDEX "conversations_trainer_id_last_message_at_idx" ON "conversations"("trainer_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_student_id_last_message_at_idx" ON "conversations"("student_id", "last_message_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_sent_at_idx" ON "messages"("conversation_id", "sent_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_owner_id_created_at_idx" ON "files"("owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_attachments_file_id_key" ON "student_attachments"("file_id");

-- CreateIndex
CREATE INDEX "student_attachments_student_id_shared_created_at_idx" ON "student_attachments"("student_id", "shared", "created_at");

-- CreateIndex
CREATE INDEX "executed_sessions_student_id_started_at_idx" ON "executed_sessions"("student_id", "started_at");

-- CreateIndex
CREATE INDEX "executed_sessions_student_id_finished_at_idx" ON "executed_sessions"("student_id", "finished_at");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_notes" ADD CONSTRAINT "trainer_notes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_notes" ADD CONSTRAINT "trainer_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamneses" ADD CONSTRAINT "anamneses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_versions" ADD CONSTRAINT "anamnesis_versions_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "anamneses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_versions" ADD CONSTRAINT "anamnesis_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_data_access_log" ADD CONSTRAINT "health_data_access_log_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_data_access_log" ADD CONSTRAINT "health_data_access_log_reader_id_fkey" FOREIGN KEY ("reader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attachments" ADD CONSTRAINT "student_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attachments" ADD CONSTRAINT "student_attachments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attachments" ADD CONSTRAINT "student_attachments_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Faixas de POST /me/body-measurements: peso de 20 a 400 kg, gordura de 2 a 70%.
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_weight" CHECK ("weight_kg" BETWEEN 20 AND 400);
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_body_fat" CHECK ("body_fat_percent" IS NULL OR "body_fat_percent" BETWEEN 2 AND 70);
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_sizes" CHECK (
  ("waist_cm" IS NULL OR "waist_cm" > 0) AND ("arm_cm" IS NULL OR "arm_cm" > 0) AND ("thigh_cm" IS NULL OR "thigh_cm" > 0)
);

ALTER TABLE "anamnesis_versions" ADD CONSTRAINT "anamnesis_versions_number" CHECK ("number" >= 1);

-- Mensagem tem texto (até 2.000 caracteres) ou anexo.
ALTER TABLE "messages" ADD CONSTRAINT "messages_text_length" CHECK ("text" IS NULL OR char_length("text") BETWEEN 1 AND 2000);
ALTER TABLE "messages" ADD CONSTRAINT "messages_has_content" CHECK ("text" IS NOT NULL OR "attachment_file_id" IS NOT NULL);

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_trainer_is_not_student" CHECK ("trainer_id" <> "student_id");

-- Até 10 MB por arquivo; arquivo pronto tem data de confirmação.
ALTER TABLE "files" ADD CONSTRAINT "files_size" CHECK ("size_bytes" BETWEEN 1 AND 10485760);
ALTER TABLE "files" ADD CONSTRAINT "files_ready_completed" CHECK (("status" = 'READY') = ("completed_at" IS NOT NULL));
