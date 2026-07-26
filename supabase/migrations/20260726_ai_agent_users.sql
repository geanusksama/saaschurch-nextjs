-- ═══════════════════════════════════════════════════════════════════════════
-- Usuários autorizados por agente de IA
--
-- Mesmo desenho de whatsapp_instance_users: o agente só fica visível/usável
-- para quem estiver marcado aqui. Um agente SEM nenhuma linha continua
-- visível para todos (compatibilidade com os agentes já cadastrados) —
-- assim que alguém é marcado, a lista passa a valer como restrição.
--
-- 100% aditiva: nenhuma tabela existente é alterada.
-- Data: 2026-07-26
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_agent_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by   uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_users_agent ON ai_agent_users(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_users_user  ON ai_agent_users(user_id);
