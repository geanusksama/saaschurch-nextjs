-- =====================================================================
-- Ajuste: vincular cada dispositivo ao AGENTE (maquina) que o gerencia,
-- separado da IGREJA que ele serve.
--
--   agent_id  = qual maquina executa o cadastro nele (fixo, na descoberta)
--   church_id = qual igreja ele serve (voce define na tela do SaaS)
--
-- Isso permite: a maquina da SEDE descobre os leitores e passa a
-- gerencia-los; depois voce atribui a igreja de cada um na tela. Se um
-- leitor for de outra congregacao, a maquina da SEDE continua executando,
-- mas so os membros daquela congregacao recebem a foto nele.
-- =====================================================================

ALTER TABLE public.faceid_devices
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.faceid_agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS faceid_devices_agent_idx
  ON public.faceid_devices (agent_id);

-- O agente tem uma igreja "casa": o padrao aplicado aos leitores recem
-- descobertos. Voce reatribui na tela os que forem de outra igreja.
-- (church_id do agente ja existe e continua NOT NULL.)
