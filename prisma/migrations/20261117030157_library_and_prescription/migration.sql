-- CreateEnum
CREATE TYPE "MesocycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemGroupType" AS ENUM ('BISET', 'SUPERSET', 'CIRCUIT');

-- CreateTable
CREATE TABLE "muscle_groups" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "muscle_groups_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "equipment" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "name" TEXT NOT NULL,
    "muscle_group_key" TEXT NOT NULL,
    "equipment_key" TEXT NOT NULL,
    "instructions" TEXT[],
    "video_url" TEXT,
    "badge_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_alternatives" (
    "id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "alternative_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exercise_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesocycles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "cloned_from_id" UUID,
    "name" TEXT NOT NULL,
    "focus" TEXT,
    "starts_on" DATE,
    "ends_on" DATE,
    "status" "MesocycleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "activated_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "mesocycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescribed_sessions" (
    "id" UUID NOT NULL,
    "mesocycle_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "prescribed_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescribed_items" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps_min" INTEGER NOT NULL,
    "reps_max" INTEGER NOT NULL,
    "rest_seconds" INTEGER NOT NULL DEFAULT 60,
    "cadence" TEXT,
    "note" TEXT,
    "group_key" TEXT,
    "group_type" "ItemGroupType",

    CONSTRAINT "prescribed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "structure" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_badge_key_key" ON "exercises"("badge_key");

-- CreateIndex
CREATE INDEX "exercises_owner_id_name_idx" ON "exercises"("owner_id", "name");

-- CreateIndex
CREATE INDEX "exercises_muscle_group_key_idx" ON "exercises"("muscle_group_key");

-- CreateIndex
CREATE INDEX "exercise_alternatives_exercise_id_approved_by_id_idx" ON "exercise_alternatives"("exercise_id", "approved_by_id");

-- CreateIndex
CREATE INDEX "mesocycles_student_id_status_idx" ON "mesocycles"("student_id", "status");

-- CreateIndex
CREATE INDEX "mesocycles_owner_id_status_idx" ON "mesocycles"("owner_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prescribed_sessions_mesocycle_id_position_key" ON "prescribed_sessions"("mesocycle_id", "position");

-- CreateIndex
CREATE INDEX "prescribed_items_exercise_id_idx" ON "prescribed_items"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "prescribed_items_session_id_position_key" ON "prescribed_items"("session_id", "position");

-- CreateIndex
CREATE INDEX "templates_trainer_id_created_at_idx" ON "templates"("trainer_id", "created_at");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_muscle_group_key_fkey" FOREIGN KEY ("muscle_group_key") REFERENCES "muscle_groups"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_equipment_key_fkey" FOREIGN KEY ("equipment_key") REFERENCES "equipment"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_alternative_id_fkey" FOREIGN KEY ("alternative_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "mesocycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescribed_sessions" ADD CONSTRAINT "prescribed_sessions_mesocycle_id_fkey" FOREIGN KEY ("mesocycle_id") REFERENCES "mesocycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "prescribed_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nome único por dono, sem diferenciar maiúsculas, entre os exercícios não excluídos.
-- Base (dono nulo) e personalizados têm espaços de nomes separados.
CREATE UNIQUE INDEX "exercises_custom_name_per_owner" ON "exercises"("owner_id", lower("name")) WHERE "owner_id" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "exercises_base_name" ON "exercises"(lower("name")) WHERE "owner_id" IS NULL AND "deleted_at" IS NULL;

-- RN10: só exercício base mapeia badge de força.
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_badge_key_only_base" CHECK ("badge_key" IS NULL OR "owner_id" IS NULL);

-- A mesma alternativa não se repete na base nem para o mesmo treinador. Dois índices parciais
-- porque NULL não se repete num índice único comum (e o Prisma removeria um índice que não declara).
CREATE UNIQUE INDEX "exercise_alternatives_base_unique" ON "exercise_alternatives"("exercise_id", "alternative_id") WHERE "approved_by_id" IS NULL;
CREATE UNIQUE INDEX "exercise_alternatives_trainer_unique" ON "exercise_alternatives"("exercise_id", "alternative_id", "approved_by_id") WHERE "approved_by_id" IS NOT NULL;
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_not_self" CHECK ("exercise_id" <> "alternative_id");

-- Um aluno tem no máximo uma ficha ativa; ativar outra arquiva a anterior na mesma transação.
CREATE UNIQUE INDEX "mesocycles_one_active_per_student" ON "mesocycles"("student_id") WHERE "status" = 'ACTIVE';
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_period" CHECK ("starts_on" IS NULL OR "ends_on" IS NULL OR "starts_on" <= "ends_on");
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_status_dates" CHECK (
  ("status" = 'DRAFT' AND "archived_at" IS NULL)
  OR ("status" = 'ACTIVE' AND "activated_at" IS NOT NULL AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
);

ALTER TABLE "prescribed_sessions" ADD CONSTRAINT "prescribed_sessions_position" CHECK ("position" >= 1);

-- Limites do RF-W05.
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_position" CHECK ("position" >= 1);
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_sets" CHECK ("sets" BETWEEN 1 AND 20);
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_reps" CHECK ("reps_min" >= 1 AND "reps_min" <= "reps_max");
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_rest" CHECK ("rest_seconds" BETWEEN 0 AND 600);
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_cadence" CHECK ("cadence" IS NULL OR "cadence" ~ '^[0-9X]{4}$');
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_note" CHECK ("note" IS NULL OR char_length("note") <= 300);
ALTER TABLE "prescribed_items" ADD CONSTRAINT "prescribed_items_group" CHECK (("group_key" IS NULL) = ("group_type" IS NULL));
