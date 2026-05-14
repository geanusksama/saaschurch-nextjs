ALTER TABLE "churches"
ADD COLUMN "headquarters_id" UUID;

ALTER TABLE "churches"
ADD CONSTRAINT "churches_headquarters_id_fkey"
FOREIGN KEY ("headquarters_id") REFERENCES "headquarters"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "churches_headquarters_id_idx" ON "churches"("headquarters_id");