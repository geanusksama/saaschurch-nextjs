ALTER TABLE "church_function_history"
  ADD COLUMN IF NOT EXISTS "department" VARCHAR(150);

DROP INDEX IF EXISTS "church_function_history_active_unique";
DROP INDEX IF EXISTS "funcoes_igreja_active_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "church_function_history_active_department_unique"
ON "church_function_history" ("church_id", "function_id", COALESCE("department", ''))
WHERE "deleted_at" IS NULL AND "end_date" IS NULL AND "is_active" = true;

CREATE TABLE IF NOT EXISTS "church_rent_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "church_id" UUID NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "address" VARCHAR(255) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "owner_name" VARCHAR(150),
  "owner_document_type" VARCHAR(10),
  "owner_document_number" VARCHAR(20),
  "paid_at" DATE NOT NULL,
  "receipt_url" VARCHAR(500),
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "church_rent_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "church_rent_records_church_id_paid_at_idx"
ON "church_rent_records"("church_id", "paid_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'church_rent_records_church_id_fkey'
  ) THEN
    ALTER TABLE "church_rent_records"
      ADD CONSTRAINT "church_rent_records_church_id_fkey"
      FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
