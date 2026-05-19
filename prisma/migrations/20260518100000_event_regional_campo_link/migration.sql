-- AlterTable: add regional_id and campo_id to events
ALTER TABLE "events" ADD COLUMN "regional_id" UUID;
ALTER TABLE "events" ADD COLUMN "campo_id" UUID;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_regional_id_fkey" FOREIGN KEY ("regional_id") REFERENCES "regionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "events_church_id_idx" ON "events"("church_id");
CREATE INDEX "events_regional_id_idx" ON "events"("regional_id");
CREATE INDEX "events_campo_id_idx" ON "events"("campo_id");

-- Backfill: preenche regional_id e campo_id a partir da church linkada
UPDATE "events" e
SET
  regional_id = c.regional_id,
  campo_id    = r.campo_id
FROM "churches" c
JOIN "regionais" r ON r.id = c.regional_id
WHERE e.church_id = c.id;
