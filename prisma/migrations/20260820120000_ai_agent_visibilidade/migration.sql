-- Visibilidade do agente de IA.
-- "global"   = disponivel em todo o sistema (widget de chat, Envios, pastoral).
-- "restrito" = visao bloqueada: so existe na tela Assistentes (Financas).
-- Os agentes que ja existiam continuam globais, para nada sumir de onde ja era usado.
ALTER TABLE "ai_agents"
  ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(20) NOT NULL DEFAULT 'global';
