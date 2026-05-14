-- AlterTable: add map_url column to church_access_info
ALTER TABLE "church_access_info" ADD COLUMN IF NOT EXISTS "map_url" VARCHAR(500);
