ALTER TABLE "members"
  ADD COLUMN IF NOT EXISTS "member_type" VARCHAR(20) DEFAULT 'MEMBRO',
  ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR(18);

UPDATE "members"
SET "member_type" = 'MEMBRO'
WHERE "member_type" IS NULL;

CREATE INDEX IF NOT EXISTS "members_member_type_idx" ON "members"("member_type");