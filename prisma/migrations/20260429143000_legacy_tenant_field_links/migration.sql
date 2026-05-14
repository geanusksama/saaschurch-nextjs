ALTER TABLE IF EXISTS "headquarters" ADD COLUMN IF NOT EXISTS "field_id" UUID;
ALTER TABLE IF EXISTS "region" ADD COLUMN IF NOT EXISTS "field_id" UUID;
ALTER TABLE IF EXISTS "church" ADD COLUMN IF NOT EXISTS "field_id" UUID;

DO $$
BEGIN
  IF to_regclass('public.headquarters') IS NOT NULL AND to_regclass('public.campos') IS NOT NULL THEN
    UPDATE "headquarters" legacy_headquarters
    SET "field_id" = current_field."id"
    FROM "campos" current_field
    WHERE legacy_headquarters."field_id" IS NULL
      AND (
        lower(coalesce(legacy_headquarters."field_name", '')) = lower(coalesce(current_field."name", ''))
        OR lower(coalesce(legacy_headquarters."field_name", '')) = lower(coalesce(current_field."code", ''))
      );
  END IF;

  IF to_regclass('public.region') IS NOT NULL AND to_regclass('public.campos') IS NOT NULL THEN
    UPDATE "region" legacy_region
    SET "field_id" = current_field."id"
    FROM "campos" current_field
    WHERE legacy_region."field_id" IS NULL
      AND (
        lower(coalesce(legacy_region."field_name", '')) = lower(coalesce(current_field."name", ''))
        OR lower(coalesce(legacy_region."field_name", '')) = lower(coalesce(current_field."code", ''))
      );

    UPDATE "region" legacy_region
    SET "field_id" = linked_headquarters."field_id"
    FROM "headquarters" linked_headquarters
    WHERE legacy_region."field_id" IS NULL
      AND legacy_region."headquarters_id" = linked_headquarters."id"
      AND linked_headquarters."field_id" IS NOT NULL;
  END IF;

  IF to_regclass('public.church') IS NOT NULL AND to_regclass('public.campos') IS NOT NULL THEN
    UPDATE "church" legacy_church
    SET "field_id" = current_field."id"
    FROM "campos" current_field
    WHERE legacy_church."field_id" IS NULL
      AND (
        lower(coalesce(legacy_church."field_name", '')) = lower(coalesce(current_field."name", ''))
        OR lower(coalesce(legacy_church."field_name", '')) = lower(coalesce(current_field."code", ''))
      );

    UPDATE "church" legacy_church
    SET "field_id" = linked_region."field_id"
    FROM "region" linked_region
    WHERE legacy_church."field_id" IS NULL
      AND legacy_church."region_id" = linked_region."id"
      AND linked_region."field_id" IS NOT NULL;

    UPDATE "church" legacy_church
    SET "field_id" = linked_headquarters."field_id"
    FROM "headquarters" linked_headquarters
    WHERE legacy_church."field_id" IS NULL
      AND legacy_church."headquarters_id" = linked_headquarters."id"
      AND linked_headquarters."field_id" IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "headquarters_field_id_idx" ON "headquarters" ("field_id");
CREATE INDEX IF NOT EXISTS "region_field_id_idx" ON "region" ("field_id");
CREATE INDEX IF NOT EXISTS "church_field_id_idx" ON "church" ("field_id");

ALTER TABLE IF EXISTS "headquarters" DROP CONSTRAINT IF EXISTS "headquarters_field_id_fkey";
ALTER TABLE IF EXISTS "region" DROP CONSTRAINT IF EXISTS "region_field_id_fkey";
ALTER TABLE IF EXISTS "church" DROP CONSTRAINT IF EXISTS "church_field_id_fkey";

ALTER TABLE IF EXISTS "headquarters"
  ADD CONSTRAINT "headquarters_field_id_fkey"
  FOREIGN KEY ("field_id") REFERENCES "campos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "region"
  ADD CONSTRAINT "region_field_id_fkey"
  FOREIGN KEY ("field_id") REFERENCES "campos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "church"
  ADD CONSTRAINT "church_field_id_fkey"
  FOREIGN KEY ("field_id") REFERENCES "campos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
