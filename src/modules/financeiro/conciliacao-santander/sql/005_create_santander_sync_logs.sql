-- Migration: 005_create_santander_sync_logs
-- Módulo: Conciliação Bancária Santander
-- Data: 2026-06-10
-- Descrição: Logs de sincronização e auditoria de importações

CREATE TABLE santander_sync_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id    UUID          NOT NULL REFERENCES santander_credentials(id),
  account_id       VARCHAR(100)  NOT NULL,
  data_inicio      DATE          NOT NULL,
  data_fim         DATE          NOT NULL,
  status           VARCHAR(20)   NOT NULL CHECK (status IN ('sucesso', 'erro', 'parcial')),
  source           VARCHAR(20)   NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'febraban', 'manual')),
  total_importado  INTEGER       NOT NULL DEFAULT 0,
  total_duplicado  INTEGER       NOT NULL DEFAULT 0,
  total_erro       INTEGER       NOT NULL DEFAULT 0,
  -- Mensagem de erro sanitizada — SEM tokens, SEM secrets, SEM número de conta completo
  error_message    TEXT,
  -- Detalhes técnicos — acessível apenas por master/admin
  raw_error        JSONB,
  started_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  created_by       VARCHAR(100)
);

CREATE INDEX idx_santander_sync_logs_credential_account
  ON santander_sync_logs (credential_id, account_id, data_inicio);

CREATE INDEX idx_santander_sync_logs_status
  ON santander_sync_logs (status);

CREATE INDEX idx_santander_sync_logs_started_at
  ON santander_sync_logs (started_at DESC);

ALTER TABLE santander_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "santander_sync_logs_service_only"
  ON santander_sync_logs
  USING (auth.role() = 'service_role');

COMMENT ON TABLE santander_sync_logs IS 'Auditoria de todas as sincronizações com a API Santander ou importações FEBRABAN 240.';
COMMENT ON COLUMN santander_sync_logs.error_message IS 'Mensagem sanitizada: sem tokens, sem secrets, sem número de conta completo.';
COMMENT ON COLUMN santander_sync_logs.raw_error IS 'Detalhes técnicos. Retornado apenas para perfis master/admin via API.';
