-- Adiciona campo is_featured à tabela app_events
-- Permite marcar um evento para aparecer em destaque no topo do app
ALTER TABLE app_events
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_app_events_is_featured
  ON app_events(is_featured)
  WHERE is_featured = TRUE;
