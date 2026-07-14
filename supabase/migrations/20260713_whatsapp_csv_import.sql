-- ═══════════════════════════════════════════════════════════════════════════
-- Importação de contatos via CSV/Excel + envio em massa orquestrado
--
-- 100% aditiva: nenhuma coluna/tabela existente é alterada ou removida.
-- As campanhas atuais (origem "portal") continuam funcionando idênticas porque
-- create_pipeline_cards tem DEFAULT false e origin tem DEFAULT 'portal'.
--
-- Data: 2026-07-13
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Lote de importação (1 por arquivo enviado) ───────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_import_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       uuid,
  owner_user_id   text NOT NULL,
  filename        text,
  -- de -> para escolhido na fase 2: { "nome": "Nome Completo", "telefone": "Celular", ... }
  mapping         jsonb NOT NULL DEFAULT '{}',
  total_rows      int NOT NULL DEFAULT 0,
  valid_rows      int NOT NULL DEFAULT 0,
  invalid_rows    int NOT NULL DEFAULT 0,
  duplicate_rows  int NOT NULL DEFAULT 0,
  member_rows     int NOT NULL DEFAULT 0,
  pipeline_rows   int NOT NULL DEFAULT 0,
  new_rows        int NOT NULL DEFAULT 0,
  -- analyzed | sending | sent | cancelled
  status          text NOT NULL DEFAULT 'analyzed',
  campaign_id     uuid REFERENCES whatsapp_campaigns (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_import_batches_owner
  ON whatsapp_import_batches (owner_user_id, created_at DESC);

-- ── Linhas do arquivo (de-para linha a linha) ────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_import_rows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL REFERENCES whatsapp_import_batches (id) ON DELETE CASCADE,
  row_number    int NOT NULL,
  -- linha original do arquivo, sem tratamento (auditoria)
  raw           jsonb NOT NULL DEFAULT '{}',
  name          text,
  phone         text,
  email         text,
  -- variáveis já no formato dos {{...}} da mensagem (nome, primeiro_nome, ...)
  variables     jsonb NOT NULL DEFAULT '{}',
  -- new | member | pipeline | both | duplicate_in_file | invalid
  match_status  text NOT NULL DEFAULT 'new',
  matched_member_id     text,
  matched_attendance_id uuid,
  -- nome da coluna/fase do pipeline onde o contato já estava (ex.: "FAZENDO")
  matched_stage text,
  -- send | skip
  decision      text NOT NULL DEFAULT 'send',
  skip_reason   text,
  -- preenchidos no envio
  recipient_id          uuid REFERENCES whatsapp_campaign_recipients (id) ON DELETE SET NULL,
  created_attendance_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_import_rows_batch
  ON whatsapp_import_rows (batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_wa_import_rows_batch_status
  ON whatsapp_import_rows (batch_id, match_status);

-- ── Campanhas: origem, lote e criação de card no pipeline ────────────────────
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'portal';
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS create_pipeline_cards boolean NOT NULL DEFAULT false;
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS attendance_type text;
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS pipeline_church_id uuid;

-- ── Destinatários: situação do contato no momento do envio ───────────────────
-- É o que permite a tela geral unificada (CSV + portal) mostrar, para cada
-- número enviado, se ele já era membro ou já estava no pipeline.
ALTER TABLE whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS match_status text;
ALTER TABLE whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS matched_member_id text;
ALTER TABLE whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS matched_attendance_id uuid;
ALTER TABLE whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS matched_stage text;
-- card criado no pipeline POR ESTE envio (coluna FAZENDO)
ALTER TABLE whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS attendance_id uuid;
ALTER TABLE whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS import_row_id uuid;

-- ── updated_at automático (reusa a função já criada em 20260703) ─────────────
DROP TRIGGER IF EXISTS trg_wa_import_batches_updated_at ON whatsapp_import_batches;
CREATE TRIGGER trg_wa_import_batches_updated_at
  BEFORE UPDATE ON whatsapp_import_batches
  FOR EACH ROW EXECUTE FUNCTION set_wa_campaign_updated_at();
