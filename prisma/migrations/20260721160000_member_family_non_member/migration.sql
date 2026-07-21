-- Núcleo familiar: permitir cadastrar familiar (ex.: filho) que NÃO é membro.
-- Antes, related_member_id era obrigatório, então só dava para vincular quem já
-- tinha cadastro de membro — inviável para crianças pequenas.

-- 1) O vínculo com membro passa a ser opcional.
ALTER TABLE "member_family_relationships"
  ALTER COLUMN "related_member_id" DROP NOT NULL;

-- 2) Dados do familiar quando não há membro vinculado.
ALTER TABLE "member_family_relationships"
  ADD COLUMN IF NOT EXISTS "related_name"       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "related_birth_date" DATE,
  ADD COLUMN IF NOT EXISTS "related_gender"     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "notes"              TEXT,
  ADD COLUMN IF NOT EXISTS "created_by"         UUID,
  ADD COLUMN IF NOT EXISTS "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deleted_at"         TIMESTAMP(3);

-- 3) O unique antigo (member_id, related_member_id, relationship_type) não serve
--    mais: com related_member_id NULL o Postgres não deduplica, e o mesmo membro
--    pode ter vários filhos não-membros. Trocamos por índices de consulta.
ALTER TABLE "member_family_relationships"
  DROP CONSTRAINT IF EXISTS "member_family_relationships_member_id_related_member_id_rela_key";

CREATE INDEX IF NOT EXISTS "member_family_relationships_member_id_idx"
  ON "member_family_relationships" ("member_id");
CREATE INDEX IF NOT EXISTS "member_family_relationships_related_member_id_idx"
  ON "member_family_relationships" ("related_member_id");
