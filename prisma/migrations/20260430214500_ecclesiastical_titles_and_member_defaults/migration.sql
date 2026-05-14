CREATE TABLE IF NOT EXISTS "ecclesiastical_titles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "abbreviation" VARCHAR(30),
  "level" INTEGER NOT NULL DEFAULT 0,
  "grouping" VARCHAR(120),
  "prerequisite_level" INTEGER,
  "minimum_age" INTEGER,
  "maximum_age" INTEGER,
  "prerequisite_occurrence" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_fixed" BOOLEAN NOT NULL DEFAULT false,
  "is_ecclesiastical_minister" BOOLEAN NOT NULL DEFAULT false,
  "allow_men" BOOLEAN NOT NULL DEFAULT true,
  "allow_women" BOOLEAN NOT NULL DEFAULT true,
  "profile" VARCHAR(120),
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "consecration_type_key" VARCHAR(50),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ecclesiastical_titles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ecclesiastical_titles_name_key" ON "ecclesiastical_titles"("name");

ALTER TABLE "members"
  ADD COLUMN IF NOT EXISTS "ecclesiastical_title_id" UUID;

ALTER TABLE "members"
  ALTER COLUMN "membership_status" SET DEFAULT 'AGUARDANDO ATIVACAO';

ALTER TABLE "members"
  ALTER COLUMN "ecclesiastical_title" SET DEFAULT 'CONGREGADO';

INSERT INTO "ecclesiastical_titles" (
  "id", "name", "abbreviation", "level", "grouping", "prerequisite_level", "minimum_age", "maximum_age",
  "prerequisite_occurrence", "is_active", "is_fixed", "is_ecclesiastical_minister", "allow_men", "allow_women",
  "profile", "display_order", "consecration_type_key"
)
VALUES
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00001', 'CONGREGADO', 'CONG', 0, 'BASE', NULL, 0, 120, 'Sem prerequisito', true, true, false, true, true, 'base', 0, '0'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00002', 'MEMBRO', 'MEM', 0, 'AGR', 3, 80, 80, 'sem dados', true, false, false, false, false, 'false', 3, '1'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00003', 'COOPERADOR', 'SCOOP', 1, 'AGR', 3, 80, 80, 'sem dados', true, false, false, false, false, 'false', 3, '7'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00004', 'COOPERADORA', 'SCOOPA', 1, 'sem', 2, 2, 2, 'nenhum', true, false, false, false, true, 'adm', 2, '8'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00005', 'DIACONO', 'CDIACNO', 2, 'AGR', 3, 80, 80, 'sem dados', true, false, false, false, false, 'false', 3, '3'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00006', 'DIACONISA', 'CDIACNO', 2, 'AGR', 3, 80, 80, 'sem dados', true, false, false, false, false, 'false', 3, '2'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00007', 'PRESBITERO', 'CONSPRESB', 3, 'AGR', 3, 80, 80, 'sem dados', true, false, false, false, false, 'false', 3, '6'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00008', 'EVANGELISTA', 'CONEV', 4, '1', 1, 0, 100, 'nennhuma', true, false, true, true, true, 'sem perfil', 1, '4'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00009', 'MISSIONARIA', 'MISS', 4, 'MISS', 1, 20, 100, 'Diaconiza', true, true, true, true, true, 'adm', 2, '9'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00010', 'MISSIONARIO', 'MISSM', 4, 'MISS', 1, 20, 100, 'Diacono', true, true, true, true, false, 'adm', 2, '10'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00011', 'PASTOR', 'CONPR', 5, 'AGR', 3, 80, 80, 'sem dados', true, false, false, false, false, 'false', 3, '5'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00012', 'PASTORA', 'CONPRF', 5, 'AGR', 3, 30, 100, 'Evangelista', true, false, true, false, true, 'adm', 3, '11'),
  ('0f9f1b7e-07b4-4f13-a8c9-0a0f10f00013', 'BISPO', 'BPS', 47, 'BISPOS', 3, 80, 45, 'Admissao de Obreiros', true, false, false, false, false, 'true', 3, '0')
ON CONFLICT ("name") DO UPDATE SET
  "abbreviation" = EXCLUDED."abbreviation",
  "level" = EXCLUDED."level",
  "grouping" = EXCLUDED."grouping",
  "prerequisite_level" = EXCLUDED."prerequisite_level",
  "minimum_age" = EXCLUDED."minimum_age",
  "maximum_age" = EXCLUDED."maximum_age",
  "prerequisite_occurrence" = EXCLUDED."prerequisite_occurrence",
  "is_active" = EXCLUDED."is_active",
  "is_fixed" = EXCLUDED."is_fixed",
  "is_ecclesiastical_minister" = EXCLUDED."is_ecclesiastical_minister",
  "allow_men" = EXCLUDED."allow_men",
  "allow_women" = EXCLUDED."allow_women",
  "profile" = EXCLUDED."profile",
  "display_order" = EXCLUDED."display_order",
  "consecration_type_key" = EXCLUDED."consecration_type_key",
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "members"
SET "membership_status" = 'AGUARDANDO ATIVACAO'
WHERE "membership_status" IS NULL OR BTRIM("membership_status") = '';

UPDATE "members"
SET "ecclesiastical_title" = 'CONGREGADO'
WHERE "ecclesiastical_title" IS NULL OR BTRIM("ecclesiastical_title") = '';

UPDATE "members" AS m
SET "ecclesiastical_title_id" = t."id"
FROM "ecclesiastical_titles" AS t
WHERE m."ecclesiastical_title_id" IS NULL
  AND UPPER(COALESCE(NULLIF(BTRIM(m."ecclesiastical_title"), ''), 'CONGREGADO')) = t."name";

UPDATE "members"
SET "ecclesiastical_title_id" = '0f9f1b7e-07b4-4f13-a8c9-0a0f10f00001'
WHERE "ecclesiastical_title_id" IS NULL;

CREATE INDEX IF NOT EXISTS "members_ecclesiastical_title_id_idx" ON "members"("ecclesiastical_title_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'members_ecclesiastical_title_id_fkey'
      AND table_name = 'members'
  ) THEN
    ALTER TABLE "members"
      ADD CONSTRAINT "members_ecclesiastical_title_id_fkey"
      FOREIGN KEY ("ecclesiastical_title_id") REFERENCES "ecclesiastical_titles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;