-- ============================================================================
-- Cronograma de Acompanhamento (jornada de 1º mês) — Gestão Pastoral
--
-- Modela a matriz do documento docs/cronograma_acompanhamento_01.pdf:
--   etapa (momento/canal/programação) × perfil (novo convertido, reconciliado,
--   vindo de outra igreja) = a mensagem que sai por WhatsApp.
--
-- Uma pessoa do pipeline é "anexada" ao cronograma (enrollment); nesse momento
-- a agenda inteira de envios é materializada em pastoral_journey_sends com a
-- data calculada a partir do dia do acolhimento. O cron
-- /api/cron/pastoral-cronograma drena essa fila com ritmo controlado,
-- distribuindo entre as instâncias escolhidas para não queimar número.
--
-- Aditiva: não altera nem apaga nada do que já existe.
-- ============================================================================

-- ── Perfil da pessoa no card do pipeline ────────────────────────────────────
-- (novo_convertido | reconciliado | outra_igreja) — NULL = não classificado
ALTER TABLE pastoral_attendances
  ADD COLUMN IF NOT EXISTS person_profile text;

CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_person_profile
  ON pastoral_attendances (church_id, person_profile);

-- ── Matriz (cronograma) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pastoral_journeys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL,
  name              text NOT NULL,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  -- ritmo de envio (o mínimo de 5 s por instância é imposto no código também)
  interval_seconds  integer NOT NULL DEFAULT 15,
  -- janela diária permitida: fora dela o cron não envia (evita madrugada)
  window_start      time NOT NULL DEFAULT '08:00',
  window_end        time NOT NULL DEFAULT '20:00',
  -- teto diário por instância; 0 = sem teto
  daily_limit_per_instance integer NOT NULL DEFAULT 0,
  owner_user_id     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastoral_journeys_church
  ON pastoral_journeys (church_id, is_active);

-- ── Instâncias orquestradas para a jornada ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pastoral_journey_instances (
  journey_id  uuid NOT NULL REFERENCES pastoral_journeys(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  PRIMARY KEY (journey_id, instance_id)
);

-- ── Etapas da matriz (as linhas do cronograma) ──────────────────────────────
CREATE TABLE IF NOT EXISTS pastoral_journey_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      uuid NOT NULL REFERENCES pastoral_journeys(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 0,
  code            text,
  -- coluna "Momento" do documento
  moment_label    text NOT NULL,
  -- coluna "Canal"
  channel         text NOT NULL DEFAULT 'WhatsApp',
  -- coluna "Programação da Semana"
  program_label   text,
  -- ── agendamento (relativo ao dia do acolhimento, nunca ao calendário) ──
  -- week_number: 1..4 · weekday: 0=domingo..6=sábado (NULL = usa só o offset)
  -- min_offset_days: piso de dias após o acolhimento antes de procurar o weekday
  week_number     integer NOT NULL DEFAULT 1,
  weekday         integer,
  min_offset_days integer NOT NULL DEFAULT 0,
  send_time       time NOT NULL DEFAULT '09:00',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastoral_journey_steps_journey
  ON pastoral_journey_steps (journey_id, position);

-- ── Mensagem de cada etapa por perfil (o miolo da matriz) ───────────────────
CREATE TABLE IF NOT EXISTS pastoral_journey_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id     uuid NOT NULL REFERENCES pastoral_journey_steps(id) ON DELETE CASCADE,
  profile     text NOT NULL,  -- novo_convertido | reconciliado | outra_igreja
  message     text NOT NULL DEFAULT '',
  image_url   text,
  link_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, profile)
);

-- ── Pessoa anexada ao cronograma ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pastoral_journey_enrollments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id     uuid NOT NULL REFERENCES pastoral_journeys(id) ON DELETE CASCADE,
  church_id      uuid NOT NULL,
  attendance_id  uuid REFERENCES pastoral_attendances(id) ON DELETE CASCADE,
  profile        text NOT NULL,
  name           text,
  phone          text NOT NULL,
  -- dia do acolhimento: toda a agenda é contada a partir daqui
  enrolled_at    timestamptz NOT NULL DEFAULT now(),
  status         text NOT NULL DEFAULT 'active', -- active|paused|completed|cancelled
  owner_user_id  text,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pastoral_journey_enrollment_attendance
  ON pastoral_journey_enrollments (journey_id, attendance_id)
  WHERE attendance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pastoral_journey_enrollments_church
  ON pastoral_journey_enrollments (church_id, status);

-- ── Fila / histórico de envios do cronograma ────────────────────────────────
CREATE TABLE IF NOT EXISTS pastoral_journey_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid NOT NULL REFERENCES pastoral_journey_enrollments(id) ON DELETE CASCADE,
  step_id         uuid NOT NULL REFERENCES pastoral_journey_steps(id) ON DELETE CASCADE,
  journey_id      uuid NOT NULL REFERENCES pastoral_journeys(id) ON DELETE CASCADE,
  church_id       uuid NOT NULL,
  attendance_id   uuid,
  profile         text NOT NULL,
  name            text,
  phone           text NOT NULL,
  -- texto congelado no momento da materialização (a edição da matriz depois
  -- não reescreve o que já foi enviado; pendentes são regravados na edição)
  message         text NOT NULL,
  link_url        text,
  image_url       text,
  scheduled_at    timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending', -- pending|sending|sent|error|skipped|cancelled
  sent_at         timestamptz,
  error_message   text,
  instance_id     uuid,
  conversation_id uuid,
  wa_message_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, step_id)
);

-- fila do cron: pendentes vencidos, mais antigo primeiro
CREATE INDEX IF NOT EXISTS idx_pastoral_journey_sends_queue
  ON pastoral_journey_sends (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_pastoral_journey_sends_church_sent
  ON pastoral_journey_sends (church_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_pastoral_journey_sends_phone
  ON pastoral_journey_sends (phone);
