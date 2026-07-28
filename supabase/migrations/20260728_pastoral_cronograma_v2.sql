-- ============================================================================
-- Cronograma de Acompanhamento — v2: varredura automática da coluna,
-- histórico numerado, teto por pessoa/dia e polimento por IA.
--
-- Motivação (as três lacunas da v1):
--  1. anexar era 100% manual — quem chegava no domingo só entrava se alguém
--     lembrasse de anexar;
--  2. o histórico não dizia "mensagem 2 de 13", então não dava para conferir
--     de olho se a jornada da pessoa estava andando;
--  3. nada impedia a pessoa de receber duas mensagens seguidas quando duas
--     etapas venciam no mesmo dia.
--
-- Aditiva: nenhuma coluna existente é alterada ou removida.
-- ============================================================================

-- ── Configuração da jornada ─────────────────────────────────────────────────
ALTER TABLE pastoral_journeys
  -- varredura automática: o cron adota sozinho quem entrar na coluna
  ADD COLUMN IF NOT EXISTS auto_enroll boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_enroll_column_key text NOT NULL DEFAULT 'doing',
  -- card movido para CONCLUÍDO/CANCELADO encerra o acompanhamento
  ADD COLUMN IF NOT EXISTS stop_on_done boolean NOT NULL DEFAULT true,
  -- teto de mensagens por PESSOA por dia (0 = sem teto). Protege contra a
  -- rajada de duas etapas vencendo juntas.
  ADD COLUMN IF NOT EXISTS max_per_person_per_day integer NOT NULL DEFAULT 1,
  -- reescrita por IA antes do envio (mantém o sentido e o versículo)
  ADD COLUMN IF NOT EXISTS ai_polish boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_agent_id uuid;

-- ── Histórico de comunicação ────────────────────────────────────────────────
ALTER TABLE pastoral_journey_sends
  -- "mensagem 2 de 13" — a conferência visual que faltava
  ADD COLUMN IF NOT EXISTS sequence integer,
  ADD COLUMN IF NOT EXISTS total_steps integer,
  -- texto antes do polimento da IA, para auditoria
  ADD COLUMN IF NOT EXISTS original_message text,
  ADD COLUMN IF NOT EXISTS ai_polished boolean NOT NULL DEFAULT false,
  -- quando duas etapas vencem juntas e são fundidas numa mensagem só
  ADD COLUMN IF NOT EXISTS merged_into_send_id uuid;

-- numera o que já existe, na ordem da matriz
UPDATE pastoral_journey_sends s
SET sequence = sub.seq,
    total_steps = sub.total
FROM (
  SELECT s2.id,
         row_number() OVER (PARTITION BY s2.enrollment_id ORDER BY st.position) AS seq,
         count(*)     OVER (PARTITION BY s2.enrollment_id)                      AS total
  FROM pastoral_journey_sends s2
  JOIN pastoral_journey_steps st ON st.id = s2.step_id
) sub
WHERE s.id = sub.id AND s.sequence IS NULL;

-- ── Quem já está em alguma jornada (consulta quente da varredura) ───────────
CREATE INDEX IF NOT EXISTS idx_pastoral_journey_enrollments_attendance
  ON pastoral_journey_enrollments (attendance_id, status);

-- envios do dia por pessoa (teto diário)
CREATE INDEX IF NOT EXISTS idx_pastoral_journey_sends_enrollment_sent
  ON pastoral_journey_sends (enrollment_id, sent_at DESC);
