-- Fase 5 (Meta): conexao de Pagina do Facebook, formularios de anuncio e potenciais membros recebidos. Aditivo.
CREATE TABLE IF NOT EXISTS "meta_paginas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "page_id" TEXT,
  "page_nome" TEXT,
  "token_cifrado" TEXT NOT NULL,
  "token_expira_em" TIMESTAMPTZ(6),
  "status" TEXT NOT NULL DEFAULT 'ativa',
  "erro_mensagem" TEXT,
  "conectado_por" UUID,
  "conectado_em" TIMESTAMPTZ(6) DEFAULT now(),
  "ultima_leitura_em" TIMESTAMPTZ(6),
  CONSTRAINT "meta_paginas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_paginas_campo_id_page_id_key" ON "meta_paginas"("campo_id", "page_id");

CREATE TABLE IF NOT EXISTS "meta_formularios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "page_id" TEXT,
  "form_id" TEXT,
  "nome" TEXT,
  "status_meta" TEXT,
  "church_id" UUID,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ultimo_cadastro_em" TIMESTAMPTZ(6),
  "atualizado_em" TIMESTAMPTZ(6) DEFAULT now(),
  CONSTRAINT "meta_formularios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_formularios_campo_id_form_id_key" ON "meta_formularios"("campo_id", "form_id");

CREATE TABLE IF NOT EXISTS "meta_potenciais_membros" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "lead_id" TEXT,
  "form_id" TEXT,
  "page_id" TEXT,
  "ad_id" TEXT,
  "church_id" UUID,
  "nome" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "respostas" JSONB,
  "criado_meta_em" TIMESTAMPTZ(6),
  "recebido_em" TIMESTAMPTZ(6) DEFAULT now(),
  "attendance_id" UUID,
  "situacao" TEXT NOT NULL,
  CONSTRAINT "meta_potenciais_membros_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_potenciais_membros_campo_id_lead_id_key" ON "meta_potenciais_membros"("campo_id", "lead_id");
CREATE INDEX IF NOT EXISTS "meta_potenciais_membros_campo_id_recebido_em_idx" ON "meta_potenciais_membros"("campo_id", "recebido_em" DESC);

DO $$ BEGIN
  ALTER TABLE "meta_paginas" ADD CONSTRAINT "meta_paginas_campo_id_fkey"
    FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "meta_formularios" ADD CONSTRAINT "meta_formularios_campo_id_fkey"
    FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "meta_potenciais_membros" ADD CONSTRAINT "meta_potenciais_membros_campo_id_fkey"
    FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Configuracao central dos formularios de anuncio (reserva: META_LEADS_CONFIG_ID).
ALTER TABLE "meta_app_config" ADD COLUMN IF NOT EXISTS "leads_config_id" TEXT;

-- RLS sem politica: so o servidor (service role) acessa.
ALTER TABLE "meta_paginas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_formularios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_potenciais_membros" ENABLE ROW LEVEL SECURITY;
