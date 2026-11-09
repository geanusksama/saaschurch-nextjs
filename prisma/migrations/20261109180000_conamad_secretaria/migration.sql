-- Campos usados pelos relatórios de Secretaria do módulo Conamad.
ALTER TABLE "conamad_ministros"
  ADD COLUMN IF NOT EXISTS "sexo" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "estado_civil" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "celular" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "endereco" TEXT,
  ADD COLUMN IF NOT EXISTS "endereco_cidade" TEXT,
  ADD COLUMN IF NOT EXISTS "credencial_status" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "credencial_liberacao" DATE,
  ADD COLUMN IF NOT EXISTS "credencial_validade" DATE,
  ADD COLUMN IF NOT EXISTS "hierarquia" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "possui_documento" BOOLEAN;
