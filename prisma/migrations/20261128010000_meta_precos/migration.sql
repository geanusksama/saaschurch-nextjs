-- Custo claro do WhatsApp Oficial: tabela de precos central (editada so no base) e cobrancas por mensagem entregue. Aditivo.
CREATE TABLE IF NOT EXISTS "meta_precos" (
  "categoria" TEXT NOT NULL,
  "moeda" TEXT NOT NULL,
  "preco" NUMERIC(12,6) NOT NULL,
  "vigencia" DATE,
  "atualizado_por" UUID,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_precos_pkey" PRIMARY KEY ("categoria", "moeda")
);

CREATE TABLE IF NOT EXISTS "meta_whatsapp_cobrancas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "meta_message_id" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "billable" BOOLEAN NOT NULL,
  "entregue_em" TIMESTAMPTZ(6) NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_whatsapp_cobrancas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_cobrancas_meta_message_id_key" ON "meta_whatsapp_cobrancas"("meta_message_id");
CREATE INDEX IF NOT EXISTS "meta_whatsapp_cobrancas_campo_id_entregue_em_idx" ON "meta_whatsapp_cobrancas"("campo_id", "entregue_em");

DO $$ BEGIN
  ALTER TABLE "meta_whatsapp_cobrancas" ADD CONSTRAINT "meta_whatsapp_cobrancas_campo_id_fkey"
    FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS sem politica: so o servidor (service role) acessa.
ALTER TABLE "meta_precos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_whatsapp_cobrancas" ENABLE ROW LEVEL SECURITY;

-- Semente: pagina oficial da Meta lida em 28/11/2026 (Brasil, utilidade e autenticacao). Marketing fica sem valor ate o master preencher.
INSERT INTO "meta_precos" ("categoria", "moeda", "preco", "vigencia") VALUES
  ('UTILITY', 'USD', 0.0068, '2026-10-01'),
  ('AUTHENTICATION', 'USD', 0.0068, '2026-10-01')
ON CONFLICT ("categoria", "moeda") DO NOTHING;
