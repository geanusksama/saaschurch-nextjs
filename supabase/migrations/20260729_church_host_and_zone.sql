-- Igreja hospedeira, zona e vínculo das anexas.
--
-- Dentro de uma regional, uma igreja central ("hospedeira", a de maior moral)
-- recebe as demais como anexas. `host_church_id` aponta da anexa para a
-- hospedeira; `is_host` marca quem é hospedeira; `zone` é a zona geográfica
-- (Zona Leste, Zona Sul, ...), usada nos filtros e nos relatórios.
--
-- Não reaproveita `parent_church_id`: aquele campo já tem outro significado
-- (hierarquia de congregação/sede) e misturar os dois quebraria a árvore atual.

ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "is_host" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "zone" VARCHAR(60);
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "host_church_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'churches_host_church_id_fkey') THEN
    ALTER TABLE "churches"
      ADD CONSTRAINT "churches_host_church_id_fkey"
      FOREIGN KEY ("host_church_id") REFERENCES "churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- Uma hospedeira não pode, ela mesma, estar anexada a outra hospedeira:
  -- isso criaria corrente de hospedagem e o relatório entraria em recursão.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'churches_host_not_hosted_check') THEN
    ALTER TABLE "churches"
      ADD CONSTRAINT "churches_host_not_hosted_check"
      CHECK (NOT ("is_host" AND "host_church_id" IS NOT NULL));
  END IF;

  -- E não pode se hospedar em si mesma.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'churches_host_not_self_check') THEN
    ALTER TABLE "churches"
      ADD CONSTRAINT "churches_host_not_self_check"
      CHECK ("host_church_id" IS NULL OR "host_church_id" <> "id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "churches_host_church_id_idx" ON "churches" ("host_church_id");
CREATE INDEX IF NOT EXISTS "churches_zone_idx" ON "churches" ("zone");
