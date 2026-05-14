ALTER TABLE "members"
ADD COLUMN IF NOT EXISTS "regional_id" UUID;

UPDATE "members" AS m
SET "regional_id" = c."regional_id"
FROM "churches" AS c
WHERE c."id" = m."church_id"
  AND m."regional_id" IS NULL;

CREATE INDEX IF NOT EXISTS "members_regional_id_idx" ON "members"("regional_id");

ALTER TABLE "members"
DROP CONSTRAINT IF EXISTS "members_regional_id_fkey";

ALTER TABLE "members"
ADD CONSTRAINT "members_regional_id_fkey"
FOREIGN KEY ("regional_id") REFERENCES "regionais"("id")
ON DELETE SET NULL ON UPDATE CASCADE;