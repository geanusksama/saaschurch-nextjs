-- Zonas geográficas (Listas e Cadastros Auxiliares). Sem dependência de
-- nenhuma outra tabela. `churches.zone` grava o NOME da zona (texto), não um
-- FK — mesmo padrão de `members.ecclesiastical_title`. Mesmas opções que já
-- rodam em produção (supabase/migrations/20260729_zonas_lookup.sql).

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
