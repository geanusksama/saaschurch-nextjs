-- WhatsApp Oficial (Meta): envio em massa (disparos, envios por pessoa e lista de exclusão). Aditivo.
CREATE TABLE IF NOT EXISTS "meta_whatsapp_disparos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "modelo_id" UUID REFERENCES "meta_whatsapp_modelos"("id") ON DELETE SET NULL,
  "modelo_nome" TEXT NOT NULL,
  "idioma" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "filtros" JSONB NOT NULL DEFAULT '{}',
  "valores" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL,
  "motivo" TEXT,
  "agendado_para" TIMESTAMPTZ(6),
  "total" INTEGER NOT NULL DEFAULT 0,
  "enviados" INTEGER NOT NULL DEFAULT 0,
  "entregues" INTEGER NOT NULL DEFAULT 0,
  "lidos" INTEGER NOT NULL DEFAULT 0,
  "falhos" INTEGER NOT NULL DEFAULT 0,
  "criado_por" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_whatsapp_disparos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meta_whatsapp_disparos_status_check" CHECK ("status" IN ('agendado', 'enviando', 'aguardando_limite', 'pausado', 'concluido', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS "meta_whatsapp_disparos_campo_id_criado_em_idx" ON "meta_whatsapp_disparos"("campo_id", "criado_em" DESC);

CREATE TABLE IF NOT EXISTS "meta_whatsapp_envios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "disparo_id" UUID NOT NULL REFERENCES "meta_whatsapp_disparos"("id") ON DELETE CASCADE,
  "campo_id" UUID NOT NULL,
  "origem" TEXT NOT NULL,
  "ref_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "parametros" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "wamid" TEXT,
  "erro_codigo" INTEGER,
  "erro" TEXT,
  "enviado_em" TIMESTAMPTZ(6),
  -- Também serve de reserva da fila: a rodada que pega um pendente põe now() + 2 min aqui.
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_whatsapp_envios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meta_whatsapp_envios_status_check" CHECK ("status" IN ('pendente', 'enviado', 'entregue', 'lido', 'falhou', 'ignorado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_envios_disparo_id_telefone_key" ON "meta_whatsapp_envios"("disparo_id", "telefone");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_envios_wamid_key" ON "meta_whatsapp_envios"("wamid") WHERE "wamid" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "meta_whatsapp_envios_disparo_id_status_idx" ON "meta_whatsapp_envios"("disparo_id", "status");
CREATE INDEX IF NOT EXISTS "meta_whatsapp_envios_campo_id_enviado_em_idx" ON "meta_whatsapp_envios"("campo_id", "enviado_em");

CREATE TABLE IF NOT EXISTS "meta_whatsapp_exclusoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "telefone" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_whatsapp_exclusoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_exclusoes_campo_id_telefone_key" ON "meta_whatsapp_exclusoes"("campo_id", "telefone");

-- RLS sem política: só o servidor (service role) acessa.
ALTER TABLE "meta_whatsapp_disparos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_whatsapp_envios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_whatsapp_exclusoes" ENABLE ROW LEVEL SECURITY;
