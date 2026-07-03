-- ═══════════════════════════════════════════════════════════════════════════
-- Envio em Massa v2: anexos (imagem/link), agente de IA por conversa
-- Spec: docs/modules/whatsapp-mass-send/SPEC.md
-- ═══════════════════════════════════════════════════════════════════════════

-- anexos da campanha: imagem enviada como anexo (mensagem vira legenda) e
-- link (ex.: vídeo) anexado ao final da mensagem
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS link_url text;

-- agente de IA (prisma ai_agents) designado para responder a conversa;
-- ai_enabled já existe e continua sendo o liga/desliga
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS ai_agent_id text;
