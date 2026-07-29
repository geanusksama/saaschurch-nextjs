-- Cadastro de Zonas (Listas e Cadastros Auxiliares).
--
-- `churches.zone` continua guardando o NOME da zona, não um FK: é o mesmo
-- padrão de `members.ecclesiastical_title`, e mantém o histórico legível se uma
-- zona for renomeada ou removida do cadastro.

CREATE TABLE IF NOT EXISTS "zonas" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          VARCHAR(60) NOT NULL,
  "abbreviation"  VARCHAR(20),
  "display_order" INTEGER,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"    TIMESTAMP(3),
  CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- Nome único entre as zonas vivas; permite recriar uma que foi excluída.
CREATE UNIQUE INDEX IF NOT EXISTS "zonas_name_unique"
  ON "zonas" (lower("name")) WHERE "deleted_at" IS NULL;

-- Sementes: as mesmas opções que estavam fixas no código da tela de igrejas.
INSERT INTO "zonas" ("name", "display_order")
SELECT z.name, z.ord
FROM (VALUES
  ('Zona Norte', 1), ('Zona Sul', 2), ('Zona Leste', 3), ('Zona Oeste', 4),
  ('Centro', 5), ('Região Metropolitana', 6), ('Interior', 7)
) AS z(name, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM "zonas" existente
  WHERE lower(existente."name") = lower(z.name) AND existente."deleted_at" IS NULL
);
