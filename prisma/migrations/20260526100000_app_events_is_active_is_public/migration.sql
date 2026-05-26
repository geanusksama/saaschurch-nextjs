-- Adiciona is_active e is_public ao app_events
-- Alinha o Prisma com a intenção do Flutter SQL 16

ALTER TABLE app_events ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_events ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: is_active = (status = 'PUBLICADO')
UPDATE app_events SET is_active = (status = 'PUBLICADO') WHERE status IS NOT NULL;

-- Índice para consulta do app Flutter
CREATE INDEX IF NOT EXISTS idx_app_events_is_active_deleted ON app_events(is_active, deleted_at);
