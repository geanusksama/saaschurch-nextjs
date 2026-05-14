-- AlterTable: add icon column to church_access_info
ALTER TABLE "church_access_info" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(30) NOT NULL DEFAULT 'Bus';
