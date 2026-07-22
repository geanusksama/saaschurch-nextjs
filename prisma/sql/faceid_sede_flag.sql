-- =====================================================================
-- "Sede" + Igreja Secundária no dispositivo.
--
-- Campos por dispositivo:
--   is_sede             -> TRUE = dispositivo da Sede: TODO membro cadastra aqui
--   church_id           -> "Igreja Vinculada" (primária) — já existia
--   secondary_church_id -> "Igreja Secundária" (congregação) — NOVO, opcional
--
-- Regra de cadastro (enrollment) para um membro da igreja C:
--   salva em  { is_sede = TRUE }  ∪  { church_id = C }  ∪  { secondary_church_id = C }
--
-- Ex.: membro da Congregação X cadastra nos leitores da Sede (is_sede) E
-- nos leitores vinculados à X (primária ou secundária). Membro da Sede
-- cadastra só nos da Sede.
--
-- Descoberta: o aparelho entra com is_sede = TRUE e church_id NULO (o
-- script não sabe a igreja). Você define na tela do SaaS.
-- =====================================================================

-- church_id aceita NULO: aparelho recém-descoberto ainda sem igreja definida.
ALTER TABLE public.faceid_devices
  ALTER COLUMN church_id DROP NOT NULL;

ALTER TABLE public.faceid_devices
  ADD COLUMN IF NOT EXISTS is_sede BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS secondary_church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS faceid_devices_sede_idx
  ON public.faceid_devices (is_sede) WHERE is_sede = TRUE;

CREATE INDEX IF NOT EXISTS faceid_devices_secondary_church_idx
  ON public.faceid_devices (secondary_church_id);
