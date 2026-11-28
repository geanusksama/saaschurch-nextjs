-- Comunicacao unificada: numero oficial da Meta usado nas telas de Comunicacao. Aditivo.
ALTER TABLE "whatsapp_instances" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'zapi';
ALTER TABLE "whatsapp_instances" ADD COLUMN IF NOT EXISTS "campo_id" UUID;
ALTER TABLE "meta_whatsapp_conexoes" ADD COLUMN IF NOT EXISTS "instancia_id" UUID;
ALTER TABLE "meta_whatsapp_conexoes" ADD COLUMN IF NOT EXISTS "teto_mensal" INTEGER;
ALTER TABLE "whatsapp_campaigns" ADD COLUMN IF NOT EXISTS "meta_modelo_id" UUID;
ALTER TABLE "whatsapp_campaigns" ADD COLUMN IF NOT EXISTS "meta_variaveis" JSONB;
ALTER TABLE "pastoral_journey_steps" ADD COLUMN IF NOT EXISTS "meta_modelo_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_instances_provider_instance_id_key"
  ON "whatsapp_instances" ("provider", "instance_id") WHERE "instance_id" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_campo_id_fkey"
    FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "meta_whatsapp_conexoes" ADD CONSTRAINT "meta_whatsapp_conexoes_instancia_id_fkey"
    FOREIGN KEY ("instancia_id") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
