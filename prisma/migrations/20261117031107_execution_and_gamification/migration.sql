-- CreateEnum
CREATE TYPE "ExecutedSessionStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "SessionClosedBy" AS ENUM ('STUDENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MutationType" AS ENUM ('SESSION_START', 'SET_UPSERT', 'SET_DELETE', 'EXERCISE_NOTE', 'EXERCISE_SUBSTITUTE', 'EXERCISE_SKIP', 'SESSION_FINISH', 'SESSION_DELETE', 'BODY_MEASUREMENT_ADD', 'MESSAGE_SEND');

-- CreateEnum
CREATE TYPE "MutationResult" AS ENUM ('APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BadgeCategory" AS ENUM ('CONSISTENCY', 'VOLUME', 'STRENGTH');

-- CreateEnum
CREATE TYPE "BadgeOriginType" AS ENUM ('SESSION', 'WEEK');

-- CreateEnum
CREATE TYPE "LoadConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "executed_sessions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "prescribed_session_id" UUID NOT NULL,
    "status" "ExecutedSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ NOT NULL,
    "last_activity_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "closed_by" "SessionClosedBy",
    "timezone" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "rpe" INTEGER,
    "duration_seconds" INTEGER,
    "volume_kg" DECIMAL(10,2),
    "completed_sets" INTEGER,
    "prescribed_sets" INTEGER,
    "counted_for_gamification" BOOLEAN,
    "not_counted_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "executed_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executed_items" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "prescribed_item_id" UUID NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "substitute_exercise_id" UUID,
    "note" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "executed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executed_sets" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "prescribed_item_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "load_kg" DECIMAL(6,2) NOT NULL,
    "reps" INTEGER NOT NULL,
    "actual_rest_seconds" INTEGER,
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "executed_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synced_mutations" (
    "client_mutation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "type" "MutationType" NOT NULL,
    "result" "MutationResult" NOT NULL,
    "error_code" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "synced_mutations_pkey" PRIMARY KEY ("client_mutation_id")
);

-- CreateTable
CREATE TABLE "week_progress" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "trained_days" INTEGER NOT NULL DEFAULT 0,
    "goal_days" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "week_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BadgeCategory" NOT NULL,
    "icon" TEXT NOT NULL,
    "criterion" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "student_badges" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "badge_key" TEXT NOT NULL,
    "unlocked_at" TIMESTAMPTZ NOT NULL,
    "origin_type" "BadgeOriginType" NOT NULL,
    "origin_session_id" UUID,
    "origin_week_start" DATE,

    CONSTRAINT "student_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_confirmations" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "set_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "load_kg" DECIMAL(6,2) NOT NULL,
    "previous_best_kg" DECIMAL(6,2) NOT NULL,
    "status" "LoadConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "load_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "executed_items_session_id_prescribed_item_id_key" ON "executed_items"("session_id", "prescribed_item_id");

-- CreateIndex
CREATE INDEX "executed_sets_session_id_prescribed_item_id_set_number_idx" ON "executed_sets"("session_id", "prescribed_item_id", "set_number");

-- CreateIndex
CREATE INDEX "executed_sets_exercise_id_completed_at_idx" ON "executed_sets"("exercise_id", "completed_at");

-- CreateIndex
CREATE INDEX "synced_mutations_user_id_received_at_idx" ON "synced_mutations"("user_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "week_progress_student_id_week_start_key" ON "week_progress"("student_id", "week_start");

-- CreateIndex
CREATE INDEX "student_badges_student_id_unlocked_at_idx" ON "student_badges"("student_id", "unlocked_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_badges_student_id_badge_key_key" ON "student_badges"("student_id", "badge_key");

-- CreateIndex
CREATE UNIQUE INDEX "load_confirmations_set_id_key" ON "load_confirmations"("set_id");

-- CreateIndex
CREATE INDEX "load_confirmations_student_id_status_idx" ON "load_confirmations"("student_id", "status");

-- AddForeignKey
ALTER TABLE "executed_sessions" ADD CONSTRAINT "executed_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_sessions" ADD CONSTRAINT "executed_sessions_prescribed_session_id_fkey" FOREIGN KEY ("prescribed_session_id") REFERENCES "prescribed_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_items" ADD CONSTRAINT "executed_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "executed_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_items" ADD CONSTRAINT "executed_items_prescribed_item_id_fkey" FOREIGN KEY ("prescribed_item_id") REFERENCES "prescribed_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_items" ADD CONSTRAINT "executed_items_substitute_exercise_id_fkey" FOREIGN KEY ("substitute_exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "executed_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_prescribed_item_id_fkey" FOREIGN KEY ("prescribed_item_id") REFERENCES "prescribed_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synced_mutations" ADD CONSTRAINT "synced_mutations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "week_progress" ADD CONSTRAINT "week_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_badge_key_fkey" FOREIGN KEY ("badge_key") REFERENCES "badges"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_origin_session_id_fkey" FOREIGN KEY ("origin_session_id") REFERENCES "executed_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_confirmations" ADD CONSTRAINT "load_confirmations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_confirmations" ADD CONSTRAINT "load_confirmations_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "executed_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_confirmations" ADD CONSTRAINT "load_confirmations_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ACTIVE_SESSION_EXISTS: no máximo uma sessão em andamento por aluno.
CREATE UNIQUE INDEX "executed_sessions_one_in_progress_per_student" ON "executed_sessions"("student_id") WHERE "status" = 'IN_PROGRESS' AND "deleted_at" IS NULL;

-- Sessão finalizada tem fim, autor do encerramento e totais; em andamento não tem nenhum deles.
ALTER TABLE "executed_sessions" ADD CONSTRAINT "executed_sessions_status_fields" CHECK (
  ("status" = 'IN_PROGRESS' AND "finished_at" IS NULL AND "closed_by" IS NULL)
  OR ("status" = 'FINISHED' AND "finished_at" IS NOT NULL AND "closed_by" IS NOT NULL
      AND "duration_seconds" IS NOT NULL AND "volume_kg" IS NOT NULL
      AND "completed_sets" IS NOT NULL AND "prescribed_sets" IS NOT NULL
      AND "counted_for_gamification" IS NOT NULL)
);
ALTER TABLE "executed_sessions" ADD CONSTRAINT "executed_sessions_period" CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at");
ALTER TABLE "executed_sessions" ADD CONSTRAINT "executed_sessions_rpe" CHECK ("rpe" IS NULL OR "rpe" BETWEEN 1 AND 10);
ALTER TABLE "executed_sessions" ADD CONSTRAINT "executed_sessions_not_counted_reason" CHECK (
  "not_counted_reason" IS NULL OR "counted_for_gamification" = false
);

ALTER TABLE "executed_items" ADD CONSTRAINT "executed_items_skip_or_substitute" CHECK (NOT ("skipped" AND "substitute_exercise_id" IS NOT NULL));

-- Limites de SET_UPSERT: carga de 0 a 1000 kg, repetições de 1 a 100.
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_load" CHECK ("load_kg" BETWEEN 0 AND 1000);
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_reps" CHECK ("reps" BETWEEN 1 AND 100);
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_set_number" CHECK ("set_number" >= 1);
ALTER TABLE "executed_sets" ADD CONSTRAINT "executed_sets_rest" CHECK ("actual_rest_seconds" IS NULL OR "actual_rest_seconds" >= 0);

ALTER TABLE "week_progress" ADD CONSTRAINT "week_progress_days" CHECK ("trained_days" BETWEEN 0 AND 7 AND "goal_days" BETWEEN 1 AND 7);
-- A semana começa na segunda-feira.
ALTER TABLE "week_progress" ADD CONSTRAINT "week_progress_starts_monday" CHECK (EXTRACT(ISODOW FROM "week_start") = 1);

-- A origem do badge é a sessão ou a semana que o liberou.
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_origin" CHECK (
  ("origin_type" = 'SESSION' AND "origin_week_start" IS NULL)
  OR ("origin_type" = 'WEEK' AND "origin_week_start" IS NOT NULL AND "origin_session_id" IS NULL)
);

ALTER TABLE "load_confirmations" ADD CONSTRAINT "load_confirmations_resolved" CHECK (("status" = 'PENDING') = ("resolved_at" IS NULL));
