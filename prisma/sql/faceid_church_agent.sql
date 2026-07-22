-- =====================================================================
-- Agente por igreja (plug and play)
-- Rodar no SQL Editor do Supabase. Depois: npx prisma generate
--
-- Um token por igreja. A maquina levada aa igreja descobre os leitores
-- da rede, auto-cadastra em faceid_devices e cuida de todos com este
-- unico token. Isolamento por igreja: o token so alcanca a sua igreja.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.faceid_agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  token       VARCHAR(100) NOT NULL UNIQUE,
  name        VARCHAR(255),
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma igreja tem, por padrao, um agente (uma maquina na rede dela).
CREATE UNIQUE INDEX IF NOT EXISTS faceid_agents_church_key
  ON public.faceid_agents (church_id);

-- Campos preenchidos pelo auto-cadastro (alem dos que ja existem):
-- device_id numerico do aparelho (o que vem no webhook) e o modelo/versao.
ALTER TABLE public.faceid_devices
  ADD COLUMN IF NOT EXISTS device_uid   VARCHAR(50),   -- device_id numerico (webhook)
  ADD COLUMN IF NOT EXISTS model        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS firmware     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mac          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS auto_provisioned BOOLEAN NOT NULL DEFAULT FALSE;

-- device_uid identifica o aparelho fisico de forma estavel (nao muda com IP).
CREATE UNIQUE INDEX IF NOT EXISTS faceid_devices_uid_key
  ON public.faceid_devices (device_uid)
  WHERE device_uid IS NOT NULL;

ALTER TABLE public.faceid_agents ENABLE ROW LEVEL SECURITY;
