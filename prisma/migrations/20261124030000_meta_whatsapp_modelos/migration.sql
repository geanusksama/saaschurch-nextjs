-- WhatsApp Oficial (Meta): espelho dos modelos de mensagem por campo. Aditivo.
CREATE TABLE IF NOT EXISTS "meta_whatsapp_modelos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "waba_id" TEXT NOT NULL,
  "meta_template_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "idioma" TEXT NOT NULL DEFAULT 'pt_BR',
  "categoria" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "motivo_recusa" TEXT,
  "componentes" JSONB NOT NULL DEFAULT '[]',
  "variaveis" JSONB NOT NULL DEFAULT '[]',
  "criado_por" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "criado_em" TIMESTAMPTZ(6) DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "sincronizado_em" TIMESTAMPTZ(6),
  CONSTRAINT "meta_whatsapp_modelos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_modelos_campo_id_meta_template_id_key" ON "meta_whatsapp_modelos"("campo_id", "meta_template_id");
CREATE INDEX IF NOT EXISTS "meta_whatsapp_modelos_campo_id_nome_idx" ON "meta_whatsapp_modelos"("campo_id", "nome");

-- RLS sem política: só o servidor (service role) acessa.
ALTER TABLE "meta_whatsapp_modelos" ENABLE ROW LEVEL SECURITY;
