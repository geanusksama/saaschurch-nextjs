-- ============================================================================
-- "Quero ser Membro" — formulário de adesão + avaliação documental.
--
-- Fluxo: a pessoa pede na home → recebe por WhatsApp um link de formulário
-- com token próprio → preenche os dados e anexa documentos → a secretaria
-- avalia num modal → aprovar cria o membro e devolve o ROL por WhatsApp;
-- reprovar devolve o motivo.
--
-- O link também fica na timeline pública do card do pipeline, para a pessoa
-- reabrir o formulário sem depender de achar a mensagem no WhatsApp.
--
-- Aditiva: as colunas antigas de new_member_requests continuam intactas, então
-- qualquer outro consumidor (app mobile, integrações) segue lendo o que lia.
-- ============================================================================

ALTER TABLE new_member_requests
  -- token do formulário (parte pública da URL). Único, sorteado no pedido.
  ADD COLUMN IF NOT EXISTS form_token text,
  ADD COLUMN IF NOT EXISTS form_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS form_submitted_at timestamptz,
  -- todos os campos preenchidos, como vieram do formulário
  ADD COLUMN IF NOT EXISTS form_data jsonb,
  -- anexos: [{ tipo, url, nome }]
  ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb,
  -- avaliação da secretaria
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  -- resultado da aprovação
  ADD COLUMN IF NOT EXISTS created_member_id uuid,
  ADD COLUMN IF NOT EXISTS member_rol integer,
  -- a adesão entra SEMPRE pela sede; a transferência para a congregação é
  -- decisão posterior da secretaria
  ADD COLUMN IF NOT EXISTS target_church_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_new_member_requests_form_token
  ON new_member_requests (form_token) WHERE form_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_new_member_requests_status
  ON new_member_requests (church_id, status, created_at DESC);
