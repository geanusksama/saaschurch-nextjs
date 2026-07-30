-- ═══════════════════════════════════════════════════════════════════════════
-- Módulo: Campanhas da Secretaria
-- Doc: docs/modules/campanhas-secretaria.md
-- Data: 2026-07-30
--
-- Campanha = um pedido da secretaria para um grupo de pessoas. Dois formatos:
--   'form'      → formulário dinâmico; a pessoa preenche, a secretaria aprova
--                 ou reprova, e a aprovação grava os campos no cadastro.
--   'broadcast' → recado só de ida (texto + imagem + link/vídeo), sem resposta.
--
-- Migration ADITIVA: só cria tabelas novas, não altera nada existente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Campanha ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secretaria_campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id      uuid,
  owner_user_id  text NOT NULL,

  name           text NOT NULL,
  -- por que a campanha existe (aparece na lista da secretaria, não no formulário)
  reason         text,
  -- texto de abertura mostrado para quem abre o link
  description    text,

  -- form | broadcast
  kind           text NOT NULL DEFAULT 'form',
  -- draft | active | closed
  status         text NOT NULL DEFAULT 'draft',

  -- Perguntas do formulário. Array de objetos; ver SecretariaCampaignField em
  -- src/lib/secretariaCampaignFields.ts. Vazio quando kind = 'broadcast'.
  form_schema    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Conteúdo enviado por WhatsApp. {{link}} é trocado pelo link da campanha.
  message_template text,
  image_url        text,
  video_url        text,
  link_url         text,

  -- instância Z-API usada no disparo (whatsapp_instances.id). Nulo = a secretaria
  -- só compartilha o link, sem disparo automático.
  instance_id    uuid REFERENCES whatsapp_instances (id) ON DELETE SET NULL,

  -- credencial do link público: /campanha/<share_token>
  share_token    text NOT NULL UNIQUE,

  -- quando true, quem abre o link avulso precisa se identificar (ROL ou CPF)
  require_identification boolean NOT NULL DEFAULT true,

  opens_at       timestamptz,
  closes_at      timestamptz,

  target_count   int NOT NULL DEFAULT 0,
  sent_count     int NOT NULL DEFAULT 0,
  response_count int NOT NULL DEFAULT 0,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_campaigns_owner  ON secretaria_campaigns (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_campaigns_status ON secretaria_campaigns (status, created_at DESC);

-- ── Pessoas anexadas à campanha ──────────────────────────────────────────────
-- Snapshot: o nome e o telefone ficam gravados como estavam no momento em que
-- a pessoa foi anexada, para o histórico não mudar se o cadastro mudar depois.
CREATE TABLE IF NOT EXISTS secretaria_campaign_targets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES secretaria_campaigns (id) ON DELETE CASCADE,

  member_id    uuid,
  name         text,
  phone        text,
  rol          int,
  church_id    uuid,
  church_name  text,
  regional_id  uuid,
  regional_name text,
  zone         text,
  title_name   text,

  -- pending | sending | sent | failed | responded | approved | rejected
  status       text NOT NULL DEFAULT 'pending',

  -- O disparo reaproveita o motor de envio em massa (whatsapp_campaigns), que
  -- já resolve instância livre, cooldown de 5 s e histórico na Caixa de Entrada.
  -- Estas duas colunas são o ponteiro para reconciliar o resultado depois.
  dispatch_campaign_id  uuid REFERENCES whatsapp_campaigns (id) ON DELETE SET NULL,
  dispatch_recipient_id uuid,
  -- link individual: /campanha/<share_token>/<token>. Já vem com a pessoa
  -- identificada, então ela não precisa digitar ROL/CPF.
  token        text NOT NULL UNIQUE,

  sent_at      timestamptz,
  error        text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- a mesma pessoa não entra duas vezes na mesma campanha
  UNIQUE (campaign_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_sec_targets_campaign ON secretaria_campaign_targets (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_targets_member   ON secretaria_campaign_targets (member_id);
CREATE INDEX IF NOT EXISTS idx_sec_targets_dispatch ON secretaria_campaign_targets (dispatch_campaign_id);

-- ── Respostas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secretaria_campaign_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES secretaria_campaigns (id) ON DELETE CASCADE,
  target_id    uuid REFERENCES secretaria_campaign_targets (id) ON DELETE SET NULL,

  member_id    uuid,
  name         text,
  phone        text,

  -- { "<fieldId>": valor } — valor é string, number, boolean ou string[]
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- [{ fieldId, url, fileName, mimeType, size }]
  files        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- pending | approved | rejected
  status       text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by  text,
  reviewed_at  timestamptz,

  -- o que a aprovação realmente gravou no cadastro: [{ field, from, to }]
  applied_fields jsonb NOT NULL DEFAULT '[]'::jsonb,

  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_responses_campaign ON secretaria_campaign_responses (campaign_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_responses_target   ON secretaria_campaign_responses (target_id);
CREATE INDEX IF NOT EXISTS idx_sec_responses_member   ON secretaria_campaign_responses (member_id);

-- Service role só: o acesso passa sempre pelas rotas /api (supabaseAdmin),
-- que aplicam o escopo de campo/regional/igreja do usuário.
ALTER TABLE secretaria_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretaria_campaign_targets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretaria_campaign_responses ENABLE ROW LEVEL SECURITY;
