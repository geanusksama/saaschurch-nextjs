ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "regional_id" UUID;

UPDATE "users" AS u
SET "regional_id" = c."regional_id"
FROM "churches" AS c
WHERE c."id" = u."church_id"
  AND u."regional_id" IS NULL;

CREATE INDEX IF NOT EXISTS "users_regional_id_idx" ON "users"("regional_id");

ALTER TABLE "users"
DROP CONSTRAINT IF EXISTS "users_regional_id_fkey";

ALTER TABLE "users"
ADD CONSTRAINT "users_regional_id_fkey"
FOREIGN KEY ("regional_id") REFERENCES "regionais"("id")
ON DELETE SET NULL ON UPDATE CASCADE;