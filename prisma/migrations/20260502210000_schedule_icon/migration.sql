-- AlterTable: add icon column to church_schedule
ALTER TABLE "church_schedule" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(30) NOT NULL DEFAULT 'Sun';
