CREATE TABLE IF NOT EXISTS "tbfuncoes" (
  "id" BIGSERIAL PRIMARY KEY,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "abreviacao" VARCHAR(255),
  "nome" VARCHAR(255),
  "ativo" BOOLEAN,
  "numero" VARCHAR(255),
  "nivelprerequisito" BIGINT,
  "idademinima" BIGINT,
  "idademaxima" BIGINT,
  "ordem" BIGINT,
  "exigirdatamin" BOOLEAN,
  "dirigente" BOOLEAN,
  "diretoria" BOOLEAN,
  "somenteministro" BOOLEAN,
  "permitirhomem" BOOLEAN,
  "permitirmulher" BOOLEAN,
  "perfis" VARCHAR(255),
  "campo" VARCHAR(255)
);

ALTER TABLE "tbfuncoes" DROP COLUMN IF EXISTS "rash";

CREATE TABLE IF NOT EXISTS "contatos_igreja" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "church_id" UUID NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150),
  "value" VARCHAR(255) NOT NULL,
  "notes" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "contatos_igreja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "funcoes_igreja" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "church_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "function_id" BIGINT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "funcoes_igreja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historico_dirigente_igreja" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "church_id" UUID NOT NULL,
  "previous_leader_member_id" UUID,
  "new_leader_member_id" UUID,
  "function_id" BIGINT,
  "indicated_by" VARCHAR(255) NOT NULL,
  "change_reason" TEXT NOT NULL,
  "entry_date" DATE NOT NULL,
  "previous_exit_date" DATE,
  "current_cash" DECIMAL(12,2),
  "average_income" DECIMAL(12,2),
  "average_expense" DECIMAL(12,2),
  "max_income" DECIMAL(12,2),
  "total_members" INTEGER,
  "total_workers" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historico_dirigente_igreja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contatos_igreja_church_id_idx" ON "contatos_igreja"("church_id");
CREATE INDEX IF NOT EXISTS "funcoes_igreja_church_id_function_id_idx" ON "funcoes_igreja"("church_id", "function_id");
CREATE INDEX IF NOT EXISTS "funcoes_igreja_member_id_idx" ON "funcoes_igreja"("member_id");
CREATE INDEX IF NOT EXISTS "historico_dirigente_igreja_church_id_entry_date_idx" ON "historico_dirigente_igreja"("church_id", "entry_date");

CREATE UNIQUE INDEX IF NOT EXISTS "funcoes_igreja_active_unique"
ON "funcoes_igreja" ("church_id", "function_id")
WHERE "deleted_at" IS NULL AND "end_date" IS NULL AND "is_active" = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contatos_igreja_church_id_fkey'
  ) THEN
    ALTER TABLE "contatos_igreja"
      ADD CONSTRAINT "contatos_igreja_church_id_fkey"
      FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'funcoes_igreja_church_id_fkey'
  ) THEN
    ALTER TABLE "funcoes_igreja"
      ADD CONSTRAINT "funcoes_igreja_church_id_fkey"
      FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'funcoes_igreja_member_id_fkey'
  ) THEN
    ALTER TABLE "funcoes_igreja"
      ADD CONSTRAINT "funcoes_igreja_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'funcoes_igreja_function_id_fkey'
  ) THEN
    ALTER TABLE "funcoes_igreja"
      ADD CONSTRAINT "funcoes_igreja_function_id_fkey"
      FOREIGN KEY ("function_id") REFERENCES "tbfuncoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historico_dirigente_igreja_church_id_fkey'
  ) THEN
    ALTER TABLE "historico_dirigente_igreja"
      ADD CONSTRAINT "historico_dirigente_igreja_church_id_fkey"
      FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historico_dirigente_igreja_previous_leader_member_id_fkey'
  ) THEN
    ALTER TABLE "historico_dirigente_igreja"
      ADD CONSTRAINT "historico_dirigente_igreja_previous_leader_member_id_fkey"
      FOREIGN KEY ("previous_leader_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historico_dirigente_igreja_new_leader_member_id_fkey'
  ) THEN
    ALTER TABLE "historico_dirigente_igreja"
      ADD CONSTRAINT "historico_dirigente_igreja_new_leader_member_id_fkey"
      FOREIGN KEY ("new_leader_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historico_dirigente_igreja_function_id_fkey'
  ) THEN
    ALTER TABLE "historico_dirigente_igreja"
      ADD CONSTRAINT "historico_dirigente_igreja_function_id_fkey"
      FOREIGN KEY ("function_id") REFERENCES "tbfuncoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;