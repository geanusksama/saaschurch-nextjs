CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_church_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_claims jsonb;
  v_church text;
BEGIN
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  v_church := COALESCE(v_claims->>'church_id', v_claims->>'churchId');
  IF v_church IS NULL OR trim(v_church) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_church::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS pastoral_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  member_id uuid REFERENCES members(id),
  visitor_member_id uuid REFERENCES members(id),
  title text NOT NULL,
  visit_type text NOT NULL CHECK (visit_type IN ('pastoral','domiciliar','hospitalar','familiar','novo_convertido','disciplina','acompanhamento')),
  status text NOT NULL CHECK (status IN ('scheduled','completed','cancelled','rescheduled','pending')) DEFAULT 'scheduled',
  priority text NOT NULL CHECK (priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
  scheduled_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  location_name text,
  address text,
  reason text,
  notes text,
  next_steps text,
  followup_required boolean NOT NULL DEFAULT false,
  followup_date timestamptz,
  responsible_id uuid REFERENCES users(id),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pastoral_visit_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  visit_id uuid NOT NULL REFERENCES pastoral_visits(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  member_id uuid REFERENCES members(id),
  role text NOT NULL CHECK (role IN ('pastor','lider','obreiro','visitante')),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pastoral_visit_prayer_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  visit_id uuid NOT NULL REFERENCES pastoral_visits(id) ON DELETE CASCADE,
  description text NOT NULL,
  is_answered boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pastoral_counselings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  member_id uuid REFERENCES members(id),
  counselor_id uuid REFERENCES users(id),
  title text NOT NULL,
  counseling_type text NOT NULL CHECK (counseling_type IN ('conjugal','familiar','espiritual','emocional','libertacao','ministerial','financeiro','outro')),
  status text NOT NULL CHECK (status IN ('active','completed','paused','cancelled')) DEFAULT 'active',
  priority text NOT NULL CHECK (priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
  description text,
  current_summary text,
  total_sessions integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  next_session_at timestamptz,
  is_confidential boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pastoral_counseling_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counseling_id uuid NOT NULL REFERENCES pastoral_counselings(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id),
  session_number integer NOT NULL,
  session_date timestamptz NOT NULL,
  duration_minutes integer,
  notes text,
  private_notes text,
  emotional_state text CHECK (emotional_state IN ('stable','anxious','sad','improving','critical')),
  spiritual_state text CHECK (spiritual_state IN ('strong','weak','growing','confused','restored')),
  progress_level integer CHECK (progress_level >= 0 AND progress_level <= 100),
  next_steps text,
  next_session_at timestamptz,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  member_id uuid REFERENCES members(id),
  requester_name text,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('saude','familia','trabalho','financas','vida_espiritual','decisoes','libertacao','gratidao','outro')),
  status text NOT NULL CHECK (status IN ('active','answered','archived')) DEFAULT 'active',
  priority text NOT NULL CHECK (priority IN ('normal','urgent')) DEFAULT 'normal',
  visibility text NOT NULL CHECK (visibility IN ('public','leadership','private')) DEFAULT 'public',
  is_anonymous boolean NOT NULL DEFAULT false,
  prayed_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  testimony_text text,
  answered_at timestamptz,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS prayer_request_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  prayer_request_id uuid NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  interaction_type text NOT NULL CHECK (interaction_type IN ('prayed','amen')),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_prayer_interaction UNIQUE (prayer_request_id, user_id, interaction_type)
);

CREATE TABLE IF NOT EXISTS prayer_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  prayer_request_id uuid NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  comment_text text NOT NULL,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS discipleship_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  name text NOT NULL,
  description text,
  stage text NOT NULL CHECK (stage IN ('fundamentos','crescimento','multiplicacao')),
  lessons_count integer NOT NULL DEFAULT 0,
  color text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS discipleships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  member_id uuid REFERENCES members(id),
  discipler_id uuid REFERENCES users(id),
  program_id uuid REFERENCES discipleship_programs(id),
  status text NOT NULL CHECK (status IN ('active','completed','paused','cancelled')) DEFAULT 'active',
  started_at timestamptz,
  completed_at timestamptz,
  next_meeting_at timestamptz,
  current_lesson integer,
  total_lessons integer,
  progress_percent integer CHECK (progress_percent >= 0 AND progress_percent <= 100),
  notes text,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS discipleship_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipleship_id uuid NOT NULL REFERENCES discipleships(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id),
  meeting_date timestamptz NOT NULL,
  lesson_number integer,
  lesson_title text,
  notes text,
  homework text,
  next_meeting_at timestamptz,
  progress_percent integer CHECK (progress_percent >= 0 AND progress_percent <= 100),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pastoral_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES users(id),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pastoral_visits_church_id ON pastoral_visits(church_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_visits_member_id ON pastoral_visits(member_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_visits_status ON pastoral_visits(status);
CREATE INDEX IF NOT EXISTS idx_pastoral_visits_scheduled_at ON pastoral_visits(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pastoral_visits_created_at ON pastoral_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastoral_visits_responsible_id ON pastoral_visits(responsible_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_visits_church_status_date ON pastoral_visits(church_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_church_id ON pastoral_counselings(church_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_member_id ON pastoral_counselings(member_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_status ON pastoral_counselings(status);
CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_priority ON pastoral_counselings(priority);
CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_created_at ON pastoral_counselings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_counselor_id ON pastoral_counselings(counselor_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_counselings_church_status_priority ON pastoral_counselings(church_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_church_id ON prayer_requests(church_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_member_id ON prayer_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_status ON prayer_requests(status);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_category ON prayer_requests(category);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_priority ON prayer_requests(priority);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_created_at ON prayer_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_composite ON prayer_requests(church_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discipleships_church_id ON discipleships(church_id);
CREATE INDEX IF NOT EXISTS idx_discipleships_member_id ON discipleships(member_id);
CREATE INDEX IF NOT EXISTS idx_discipleships_status ON discipleships(status);
CREATE INDEX IF NOT EXISTS idx_discipleships_discipler_id ON discipleships(discipler_id);
CREATE INDEX IF NOT EXISTS idx_discipleships_created_at ON discipleships(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discipleships_composite ON discipleships(church_id, status, program_id);

CREATE INDEX IF NOT EXISTS idx_pastoral_audit_logs_entity ON pastoral_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_audit_logs_church_created ON pastoral_audit_logs(church_id, created_at DESC);

CREATE OR REPLACE VIEW pastoral_timeline AS
SELECT
  id,
  church_id,
  member_id,
  'visit'::text AS type,
  title,
  COALESCE(notes, reason) AS description,
  COALESCE(scheduled_at, created_at) AS event_date,
  responsible_id::text AS responsible_name,
  status,
  jsonb_build_object('visit_type', visit_type, 'priority', priority) AS metadata
FROM pastoral_visits
WHERE deleted_at IS NULL
UNION ALL
SELECT
  id,
  church_id,
  member_id,
  'counseling'::text AS type,
  title,
  COALESCE(current_summary, description) AS description,
  COALESCE(started_at, created_at) AS event_date,
  counselor_id::text AS responsible_name,
  status,
  jsonb_build_object('counseling_type', counseling_type, 'priority', priority) AS metadata
FROM pastoral_counselings
WHERE deleted_at IS NULL
UNION ALL
SELECT
  id,
  church_id,
  member_id,
  'prayer_request'::text AS type,
  title,
  description,
  created_at AS event_date,
  created_by::text AS responsible_name,
  status,
  jsonb_build_object('category', category, 'priority', priority) AS metadata
FROM prayer_requests
WHERE deleted_at IS NULL
UNION ALL
SELECT
  id,
  church_id,
  member_id,
  'discipleship'::text AS type,
  COALESCE('Discipulado', 'Discipulado') AS title,
  notes AS description,
  COALESCE(started_at, created_at) AS event_date,
  discipler_id::text AS responsible_name,
  status,
  jsonb_build_object('program_id', program_id, 'progress_percent', progress_percent) AS metadata
FROM discipleships
WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_pastoral_visits_touch_updated_at ON pastoral_visits;
CREATE TRIGGER trg_pastoral_visits_touch_updated_at BEFORE UPDATE ON pastoral_visits FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_pastoral_visit_participants_touch_updated_at ON pastoral_visit_participants;
CREATE TRIGGER trg_pastoral_visit_participants_touch_updated_at BEFORE UPDATE ON pastoral_visit_participants FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_pastoral_visit_prayer_points_touch_updated_at ON pastoral_visit_prayer_points;
CREATE TRIGGER trg_pastoral_visit_prayer_points_touch_updated_at BEFORE UPDATE ON pastoral_visit_prayer_points FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_pastoral_counselings_touch_updated_at ON pastoral_counselings;
CREATE TRIGGER trg_pastoral_counselings_touch_updated_at BEFORE UPDATE ON pastoral_counselings FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_pastoral_counseling_sessions_touch_updated_at ON pastoral_counseling_sessions;
CREATE TRIGGER trg_pastoral_counseling_sessions_touch_updated_at BEFORE UPDATE ON pastoral_counseling_sessions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_prayer_requests_touch_updated_at ON prayer_requests;
CREATE TRIGGER trg_prayer_requests_touch_updated_at BEFORE UPDATE ON prayer_requests FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_prayer_request_interactions_touch_updated_at ON prayer_request_interactions;
CREATE TRIGGER trg_prayer_request_interactions_touch_updated_at BEFORE UPDATE ON prayer_request_interactions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_prayer_request_comments_touch_updated_at ON prayer_request_comments;
CREATE TRIGGER trg_prayer_request_comments_touch_updated_at BEFORE UPDATE ON prayer_request_comments FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_discipleship_programs_touch_updated_at ON discipleship_programs;
CREATE TRIGGER trg_discipleship_programs_touch_updated_at BEFORE UPDATE ON discipleship_programs FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_discipleships_touch_updated_at ON discipleships;
CREATE TRIGGER trg_discipleships_touch_updated_at BEFORE UPDATE ON discipleships FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_discipleship_meetings_touch_updated_at ON discipleship_meetings;
CREATE TRIGGER trg_discipleship_meetings_touch_updated_at BEFORE UPDATE ON discipleship_meetings FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS trg_pastoral_audit_logs_touch_updated_at ON pastoral_audit_logs;
CREATE TRIGGER trg_pastoral_audit_logs_touch_updated_at BEFORE UPDATE ON pastoral_audit_logs FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE pastoral_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_visit_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_visit_prayer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_counselings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_counseling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_request_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipleship_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipleships ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipleship_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'pastoral_visits',
      'pastoral_visit_participants',
      'pastoral_visit_prayer_points',
      'pastoral_counselings',
      'pastoral_counseling_sessions',
      'prayer_requests',
      'prayer_request_interactions',
      'prayer_request_comments',
      'discipleship_programs',
      'discipleships',
      'discipleship_meetings',
      'pastoral_audit_logs'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'church_scope_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id()) WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id())',
      'church_scope_' || t,
      t
    );
  END LOOP;
END $$;
