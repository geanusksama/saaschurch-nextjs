-- Adiciona campo_id na tabela app_events para suporte ao filtro do app Flutter
ALTER TABLE app_events ADD COLUMN IF NOT EXISTS campo_id UUID;

-- Backfill: deriva campo_id de church → regional → campo
UPDATE app_events ae
SET campo_id = r.campo_id
FROM churches c
JOIN regionais r ON r.id = c.regional_id
WHERE c.id = ae.church_id
  AND ae.campo_id IS NULL;

-- Índice para as queries do app Flutter (filtra por campo_id + status)
CREATE INDEX IF NOT EXISTS app_events_campo_id_status_idx ON app_events(campo_id, status);
