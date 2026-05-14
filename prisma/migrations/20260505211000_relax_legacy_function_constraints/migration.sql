ALTER TABLE IF EXISTS "church_function_history"
  ALTER COLUMN "legacy_function_id" DROP NOT NULL;

ALTER TABLE IF EXISTS "church_leader_history"
  ALTER COLUMN "legacy_function_id" DROP NOT NULL;