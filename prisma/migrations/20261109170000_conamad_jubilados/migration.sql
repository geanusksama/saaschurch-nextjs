-- Relatório "Status de Ministro Jubilados" do CONAMAD.
ALTER TABLE "conamad_ministros" ADD COLUMN IF NOT EXISTS "jubilado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conamad_ministros" ADD COLUMN IF NOT EXISTS "jubilado_estado" VARCHAR(2);
ALTER TABLE "conamad_ministros" ADD COLUMN IF NOT EXISTS "jubilado_anuidade" VARCHAR(40);
