-- ═══════════════════════════════════════════════════════════════════════════
-- Resposta humanizada do agente de IA no WhatsApp
--
-- Antes: cada mensagem recebida disparava uma resposta imediata. Resultado —
-- respostas instantâneas (nada humano) e uma resposta para cada mensagem quando
-- a pessoa escrevia em três partes.
--
-- Agora existe UMA linha por conversa nesta fila: cada nova mensagem (ou o
-- "digitando..." da pessoa) empurra o due_at para frente. Quando o tempo vence,
-- o worker responde UMA vez, já lendo todas as mensagens acumuladas.
--
-- 100% aditiva. Data: 2026-07-26
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whatsapp_ai_reply_queue (
  conversation_id  uuid PRIMARY KEY REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  instance_id      uuid NOT NULL,
  phone            text NOT NULL,
  -- quando a resposta pode sair (empurrado a cada mensagem/digitação)
  due_at           timestamptz NOT NULL,
  -- teto: mesmo que a pessoa não pare de digitar, respondemos até aqui
  deadline_at      timestamptz NOT NULL,
  -- última mensagem recebida, usada para marcar como lida
  last_message_id  text,
  pending_count    integer NOT NULL DEFAULT 1,
  status           text NOT NULL DEFAULT 'pending',  -- pending | processing
  attempts         integer NOT NULL DEFAULT 0,
  locked_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_ai_queue_due ON whatsapp_ai_reply_queue(status, due_at);
