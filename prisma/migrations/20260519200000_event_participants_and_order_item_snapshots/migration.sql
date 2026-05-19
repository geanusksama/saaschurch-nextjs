-- Migration: event_participants model + snapshot fields on event_order_items
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).

-- 1. event_participants já foi criada via supabase migration 20260518.
--    Garantir que existe caso o DB seja recriado do zero.
CREATE TABLE IF NOT EXISTS event_participants (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID         NOT NULL REFERENCES app_events(id) ON DELETE CASCADE,
  nome       VARCHAR(255) NOT NULL,
  papel      VARCHAR(100),
  foto_url   TEXT,
  ordem      SMALLINT     DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

-- 2. Colunas de snapshot desnormalizadas em event_order_items (escritas pelo app Flutter).
ALTER TABLE event_order_items
  ADD COLUMN IF NOT EXISTS sector_nome TEXT,
  ADD COLUMN IF NOT EXISTS row_nome    TEXT,
  ADD COLUMN IF NOT EXISTS seat_numero INTEGER;
