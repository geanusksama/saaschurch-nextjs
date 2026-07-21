-- =====================================================================
-- Cadastro remoto de Face ID (Control iD) — schema
-- Rodar no SQL Editor do Supabase.
--
-- OBS: aplicado via SQL puro porque `prisma migrate dev` está quebrado
-- neste projeto (migration 20260505222500_backfill_church_leader_roll
-- falha no shadow DB). Depois de rodar: npx prisma generate
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. faceid_devices: dados de acesso local ao aparelho
-- ---------------------------------------------------------------------
ALTER TABLE public.faceid_devices
  ADD COLUMN IF NOT EXISTS local_host   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS local_port   INTEGER DEFAULT 80,
  ADD COLUMN IF NOT EXISTS agent_token  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS faceid_devices_agent_token_key
  ON public.faceid_devices (agent_token)
  WHERE agent_token IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. face_enrollment_jobs: fila de cadastro
--    Um job por (membro, dispositivo). batch_id agrupa os jobs criados
--    numa mesma solicitação — uma igreja com 3 leitores gera 3 jobs.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.face_enrollment_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL,
  church_id     UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  device_id     UUID NOT NULL REFERENCES public.faceid_devices(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL,

  -- Dados enviados ao aparelho (mapeamento Control iD):
  --   rol   -> user.id           (campo "Código" na UI do aparelho)
  --   nome  -> user.name         (campo "Nome")
  --   cpf   -> user.registration (campo "Matrícula")
  rol           INTEGER NOT NULL,
  nome          VARCHAR(255) NOT NULL,
  cpf           VARCHAR(20),
  photo_url     TEXT NOT NULL,

  -- pending | processing | done | failed | needs_approval | rejected
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  allow_update  BOOLEAN NOT NULL DEFAULT FALSE,

  error_code    INTEGER,
  error_message TEXT,
  match_user_id INTEGER,

  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS face_enrollment_jobs_pending_idx
  ON public.face_enrollment_jobs (device_id, status)
  WHERE status IN ('pending', 'needs_approval');

CREATE INDEX IF NOT EXISTS face_enrollment_jobs_batch_idx
  ON public.face_enrollment_jobs (batch_id);

CREATE INDEX IF NOT EXISTS face_enrollment_jobs_member_idx
  ON public.face_enrollment_jobs (member_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. face_enrollment_signals: canal de aviso via Realtime
--
--    O agente roda numa máquina da igreja. Ele NÃO deve receber foto,
--    CPF ou nome pelo websocket — só o aviso de que existe trabalho.
--    Os dados reais ele busca na API autenticado com o token do
--    dispositivo. Por isso esta tabela não tem nenhum dado pessoal.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.face_enrollment_signals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL,
  device_id  UUID NOT NULL,
  church_id  UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS face_enrollment_signals_device_idx
  ON public.face_enrollment_signals (device_id, created_at DESC);

-- Trigger: todo job que entra como 'pending' emite um sinal.
-- Jobs em 'needs_approval' NÃO emitem — só depois que a secretaria libera.
CREATE OR REPLACE FUNCTION public.fn_face_enrollment_signal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.face_enrollment_signals (job_id, device_id, church_id)
    VALUES (NEW.id, NEW.device_id, NEW.church_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_face_enrollment_signal_ins ON public.face_enrollment_jobs;
CREATE TRIGGER trg_face_enrollment_signal_ins
  AFTER INSERT ON public.face_enrollment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_face_enrollment_signal();

-- Também emite quando um job sai de needs_approval para pending (aprovação)
DROP TRIGGER IF EXISTS trg_face_enrollment_signal_upd ON public.face_enrollment_jobs;
CREATE TRIGGER trg_face_enrollment_signal_upd
  AFTER UPDATE OF status ON public.face_enrollment_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending')
  EXECUTE FUNCTION public.fn_face_enrollment_signal();

-- ---------------------------------------------------------------------
-- 4. Realtime + RLS
-- ---------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.face_enrollment_signals;

ALTER TABLE public.face_enrollment_signals ENABLE ROW LEVEL SECURITY;

-- Sinal não contém dado pessoal — leitura liberada para anon (o agente).
DROP POLICY IF EXISTS face_signals_read ON public.face_enrollment_signals;
CREATE POLICY face_signals_read ON public.face_enrollment_signals
  FOR SELECT USING (true);

-- Jobs contêm PII: bloqueados para anon/authenticated.
-- Acesso apenas via service_role (API Next.js), que ignora RLS.
ALTER TABLE public.face_enrollment_jobs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 5. Limpeza de sinais antigos (evita crescimento infinito)
-- ---------------------------------------------------------------------
DELETE FROM public.face_enrollment_signals WHERE created_at < NOW() - INTERVAL '7 days';
