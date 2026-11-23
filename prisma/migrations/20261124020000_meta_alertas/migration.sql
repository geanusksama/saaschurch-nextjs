-- WhatsApp Oficial (Meta): alertas do monitor diario. Aditivo.
CREATE TABLE IF NOT EXISTS "meta_alertas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID REFERENCES "campos"("id") ON DELETE CASCADE,
  "tipo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "proposta" JSONB,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "resolvido_em" TIMESTAMPTZ(6),
  "resolvido_por" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "meta_alertas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "meta_alertas_resolvido_em_criado_em_idx" ON "meta_alertas"("resolvido_em", "criado_em");

-- RLS sem política: só o servidor (service role) acessa.
ALTER TABLE "meta_alertas" ENABLE ROW LEVEL SECURITY;
