DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'church_photo_church_id_fkey'
  ) THEN
    ALTER TABLE "church_photo"
      DROP CONSTRAINT "church_photo_church_id_fkey";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'church_photo_church_id_fkey'
  ) THEN
    ALTER TABLE "church_photo"
      ADD CONSTRAINT "church_photo_church_id_fkey"
      FOREIGN KEY ("church_id") REFERENCES "churches"("id")
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;