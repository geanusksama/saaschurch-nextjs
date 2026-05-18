-- ============================================================
-- MIGRAÇÃO: Rastreamento por usuário de interações no Pão Diário
-- Execute no Supabase → SQL Editor (idempotente)
-- ============================================================

-- Tabela de interações individuais (play, read, share)
-- Permite exportar a lista de pessoas que interagiram com cada devocional
CREATE TABLE IF NOT EXISTS app_daily_bread_interactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   UUID        NOT NULL REFERENCES app_daily_bread_entries(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,
  type       VARCHAR(10) NOT NULL,   -- 'play' | 'read' | 'share'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entry_id, user_id, type)   -- evita duplicatas por usuário/tipo
);

CREATE INDEX IF NOT EXISTS idx_daily_bread_interactions_entry ON app_daily_bread_interactions(entry_id);
CREATE INDEX IF NOT EXISTS idx_daily_bread_interactions_user  ON app_daily_bread_interactions(user_id);

-- ============================================================
-- FLUTTER: para registrar interação chame esta função ou
-- faça upsert direto:
--   supabase.from('app_daily_bread_interactions').upsert({
--     entry_id: <uuid>, user_id: <uuid>, type: 'play' | 'read' | 'share'
--   }, { onConflict: 'entry_id,user_id,type' })
-- ============================================================
