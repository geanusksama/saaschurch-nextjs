-- WhatsApp Oficial (Meta Cloud API): conexao por campo. Aditiva.
CREATE TABLE IF NOT EXISTS "meta_whatsapp_conexoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID NOT NULL,
  "waba_id" TEXT NOT NULL,
  "phone_number_id" TEXT NOT NULL,
  "numero" TEXT,
  "nome_exibicao" TEXT,
  "token_cifrado" TEXT NOT NULL,
  "pin_cifrado" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'conectado',
  "ultimo_erro" TEXT,
  "conectado_por" UUID,
  "conectado_em" TIMESTAMPTZ(6) DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_whatsapp_conexoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_conexoes_campo_id_key" ON "meta_whatsapp_conexoes"("campo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_conexoes_phone_number_id_key" ON "meta_whatsapp_conexoes"("phone_number_id");

ALTER TABLE "meta_whatsapp_conexoes" ADD CONSTRAINT "meta_whatsapp_conexoes_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_whatsapp_conexoes" ADD CONSTRAINT "meta_whatsapp_conexoes_conectado_por_fkey" FOREIGN KEY ("conectado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS sem política: só o servidor (service role) acessa.
ALTER TABLE "meta_whatsapp_conexoes" ENABLE ROW LEVEL SECURITY;
