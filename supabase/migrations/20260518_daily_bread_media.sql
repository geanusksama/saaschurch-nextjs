-- ============================================================
-- MIGRAÇÃO: Mídias e contadores para app_daily_bread_entries
-- Execute no Supabase → SQL Editor (idempotente)
-- ============================================================

ALTER TABLE app_daily_bread_entries
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  ADD COLUMN IF NOT EXISTS play_count  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0;

-- Garante que audio_url e audio_duration_seconds existem
ALTER TABLE app_daily_bread_entries
  ADD COLUMN IF NOT EXISTS audio_url              TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INT DEFAULT 0;

-- Tabela de likes (cria se ainda não existir)
CREATE TABLE IF NOT EXISTS app_daily_bread_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   UUID        NOT NULL REFERENCES app_daily_bread_entries(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entry_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_bread_likes_entry ON app_daily_bread_likes(entry_id);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
