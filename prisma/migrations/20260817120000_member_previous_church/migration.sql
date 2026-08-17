-- Histórico do membro em outras igrejas (antes de entrar nesta).
-- Digitado pela secretaria: a igreja de origem não existe no cadastro, então
-- nome da igreja, títulos e pastor são texto livre.
CREATE TABLE IF NOT EXISTS "member_previous_churches" (
  "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "member_id"            UUID         NOT NULL,
  "church_name"          VARCHAR(255) NOT NULL,
  "ecclesiastical_title" VARCHAR(120),
  "conversion_date"      DATE,
  "baptism_date"         DATE,
  "consecration_date"    DATE,
  "consecration_title"   VARCHAR(120),
  "pastor_name"          VARCHAR(255),
  "functions"            TEXT,
  "notes"                TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"           UUID,
  "updated_by"           UUID,
  "deleted_at"           TIMESTAMP(3),

  CONSTRAINT "member_previous_churches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "member_previous_churches"
  DROP CONSTRAINT IF EXISTS "member_previous_churches_member_id_fkey";

ALTER TABLE "member_previous_churches"
  ADD CONSTRAINT "member_previous_churches_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "member_previous_churches_member_id_idx"
  ON "member_previous_churches" ("member_id");
