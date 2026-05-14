-- AlterTable: add email, whatsapp, zipcode to headquarters
ALTER TABLE "headquarters"
  ADD COLUMN IF NOT EXISTS "email" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "whatsapp" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "zipcode" VARCHAR(10);

-- CreateTable: church_schedule
CREATE TABLE IF NOT EXISTS "church_schedule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "headquarters_id" UUID NOT NULL,
  "day_of_week" VARCHAR(20) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "time" VARCHAR(10) NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "church_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: church_access_info
CREATE TABLE IF NOT EXISTS "church_access_info" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "headquarters_id" UUID NOT NULL,
  "type" VARCHAR(20) NOT NULL DEFAULT 'bus',
  "description" VARCHAR(500) NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "church_access_info_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "church_schedule" ADD CONSTRAINT "church_schedule_headquarters_id_fkey"
  FOREIGN KEY ("headquarters_id") REFERENCES "headquarters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "church_access_info" ADD CONSTRAINT "church_access_info_headquarters_id_fkey"
  FOREIGN KEY ("headquarters_id") REFERENCES "headquarters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
