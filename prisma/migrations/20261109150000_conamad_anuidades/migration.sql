-- CONAMAD: matrícula do ministro, espelho de ministros e anuidades. Só acréscimos.
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "matricula_conamad" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "members_matricula_conamad_key" ON "members"("matricula_conamad");

CREATE TABLE IF NOT EXISTS "conamad_ministros" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "conamad_id" UUID NOT NULL,
  "matricula" INTEGER NOT NULL,
  "member_id" UUID,
  "casamento" VARCHAR(60),
  "nome" VARCHAR(255) NOT NULL,
  "documento" VARCHAR(20),
  "titulo" VARCHAR(30),
  "situacao" VARCHAR(20),
  "igreja" VARCHAR(255),
  "data_nascimento" DATE,
  "foto_url" VARCHAR(500),
  "sincronizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conamad_ministros_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conamad_ministros_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conamad_ministros_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "conamad_ministros_conamad_id_key" ON "conamad_ministros"("conamad_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conamad_ministros_matricula_key" ON "conamad_ministros"("matricula");
CREATE INDEX IF NOT EXISTS "conamad_ministros_campo_id_situacao_idx" ON "conamad_ministros"("campo_id", "situacao");
CREATE INDEX IF NOT EXISTS "conamad_ministros_member_id_idx" ON "conamad_ministros"("member_id");

CREATE TABLE IF NOT EXISTS "conamad_anuidades" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "conamad_id" UUID NOT NULL,
  "ministro_id" UUID,
  "matricula" INTEGER NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "titulo" VARCHAR(30),
  "situacao_ministro" VARCHAR(20),
  "igreja" VARCHAR(255),
  "ano_referencia" INTEGER NOT NULL,
  "valor" DECIMAL(12,2) NOT NULL,
  "situacao" VARCHAR(20) NOT NULL,
  "motivo_isencao" VARCHAR(120),
  "parcelado" BOOLEAN NOT NULL DEFAULT false,
  "observacao" TEXT,
  "data_vencimento" TIMESTAMP(3),
  "criado_no_conamad_em" TIMESTAMP(3),
  "alterado_no_conamad_em" TIMESTAMP(3),
  "sincronizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conamad_anuidades_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conamad_anuidades_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conamad_anuidades_ministro_id_fkey" FOREIGN KEY ("ministro_id") REFERENCES "conamad_ministros"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "conamad_anuidades_conamad_id_key" ON "conamad_anuidades"("conamad_id");
CREATE INDEX IF NOT EXISTS "conamad_anuidades_campo_id_ano_referencia_situacao_idx" ON "conamad_anuidades"("campo_id", "ano_referencia", "situacao");
CREATE INDEX IF NOT EXISTS "conamad_anuidades_ministro_id_idx" ON "conamad_anuidades"("ministro_id");
CREATE INDEX IF NOT EXISTS "conamad_anuidades_matricula_idx" ON "conamad_anuidades"("matricula");

CREATE TABLE IF NOT EXISTS "conamad_sincronizacoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "usuario_id" UUID,
  "origem" VARCHAR(40) NOT NULL,
  "arquivo" VARCHAR(255),
  "resumo" JSONB,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conamad_sincronizacoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conamad_sincronizacoes_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "conamad_sincronizacoes_campo_id_criado_em_idx" ON "conamad_sincronizacoes"("campo_id", "criado_em");

-- Acesso só pelas rotas do servidor: sem política, o navegador não lê estas tabelas.
ALTER TABLE "conamad_ministros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conamad_anuidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conamad_sincronizacoes" ENABLE ROW LEVEL SECURITY;
