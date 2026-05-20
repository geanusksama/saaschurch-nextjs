-- Add attachment and archive fields to notifications
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "image_url"    VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "file_url"     VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "file_name"    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "archived"     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "archived_at"  TIMESTAMPTZ;

-- Create notification_acks table
CREATE TABLE IF NOT EXISTS "notification_acks" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID         NOT NULL,
  "user_id"         UUID         NOT NULL,
  "batch_id"        VARCHAR(255),
  "ack_type"        VARCHAR(20)  NOT NULL,
  "acked_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "notification_acks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_acks_notification_id_user_id_ack_type_key"
    UNIQUE ("notification_id", "user_id", "ack_type"),
  CONSTRAINT "notification_acks_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE,
  CONSTRAINT "notification_acks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
