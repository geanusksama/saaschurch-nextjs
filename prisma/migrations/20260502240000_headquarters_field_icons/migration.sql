-- AlterTable: add field_icons JSON column to headquarters
ALTER TABLE "headquarters" ADD COLUMN IF NOT EXISTS "field_icons" JSONB NOT NULL DEFAULT '{}';
