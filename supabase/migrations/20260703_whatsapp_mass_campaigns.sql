-- ═══════════════════════════════════════════════════════════════════════════
-- Módulo: Envio de WhatsApp em Massa (Campanhas)
-- Spec: docs/modules/whatsapp-mass-send/SPEC.md
-- Data: 2026-07-03
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Campanhas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id        uuid,
  owner_user_id    text NOT NULL,
  name             text NOT NULL,
  message_template text NOT NULL,
  -- draft | running | paused | completed | cancelled
  status           text NOT NULL DEFAULT 'draft',
  interval_seconds int  NOT NULL DEFAULT 5,
  total_recipients int  NOT NULL DEFAULT 0,
  sent_count       int  NOT NULL DEFAULT 0,
  error_count      int  NOT NULL DEFAULT 0,
  agent_user_ids   text[] NOT NULL DEFAULT '{}',
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_owner  ON whatsapp_campaigns (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status ON whatsapp_campaigns (status);

-- ── Instâncias alocadas por campanha ─────────────────────────────────────────
-- A instância NÃO é pré-atribuída ao destinatário: o escalonador escolhe em
-- tempo de envio a instância cujo cooldown de 5 s já expirou. Esta tabela
-- registra quais instâncias participam e acumula contadores por instância.
CREATE TABLE IF NOT EXISTS whatsapp_campaign_instances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES whatsapp_campaigns (id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES whatsapp_instances (id) ON DELETE CASCADE,
  sent_count  int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_instances_campaign
  ON whatsapp_campaign_instances (campaign_id);

-- ── Destinatários (snapshot no momento da criação) ───────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES whatsapp_campaigns (id) ON DELETE CASCADE,
  -- member | pipeline
  source        text NOT NULL,
  source_id     text NOT NULL,
  name          text,
  phone         text NOT NULL,
  -- snapshot das variáveis de template: nome, igreja, regional, rol, cargo...
  variables     jsonb NOT NULL DEFAULT '{}',
  -- instância que efetivamente enviou (preenchida pelo escalonador no envio)
  instance_id   uuid REFERENCES whatsapp_instances (id) ON DELETE SET NULL,
  -- agente/atendente responsável pelas respostas (round-robin na criação)
  agent_user_id text,
  -- pending | sending | sent | error | cancelled
  status        text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign_status
  ON whatsapp_campaign_recipients (campaign_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign
  ON whatsapp_campaign_recipients (campaign_id);

-- ── updated_at automático ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_wa_campaign_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wa_campaigns_updated_at ON whatsapp_campaigns;
CREATE TRIGGER trg_wa_campaigns_updated_at
  BEFORE UPDATE ON whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_wa_campaign_updated_at();
