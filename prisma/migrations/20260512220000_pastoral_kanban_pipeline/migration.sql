-- ============================================================
-- Pipeline de Atendimento Pastoral (Kanban CRM)
-- ============================================================

-- 1. Tabela principal do pipeline
CREATE TABLE IF NOT EXISTS pastoral_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Atendimento Pastoral',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastoral_pipelines_church_id ON pastoral_pipelines(church_id);

-- 2. Colunas do pipeline (as 4 fixas: POR FAZER, FAZENDO, CONCLUÍDO, CANCELADO)
CREATE TABLE IF NOT EXISTS pastoral_pipeline_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pastoral_pipelines(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  icon text,
  fixed_column boolean NOT NULL DEFAULT true,
  column_key text NOT NULL, -- 'todo' | 'doing' | 'done' | 'cancelled'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastoral_pipeline_columns_pipeline_id ON pastoral_pipeline_columns(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_pipeline_columns_church_id ON pastoral_pipeline_columns(church_id);

-- 3. Tipos de atendimento permitidos por coluna
CREATE TABLE IF NOT EXISTS pastoral_column_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES pastoral_pipeline_columns(id) ON DELETE CASCADE,
  attendance_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Atendimentos (cards do kanban)
CREATE TABLE IF NOT EXISTS pastoral_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  pipeline_id uuid REFERENCES pastoral_pipelines(id),
  column_id uuid REFERENCES pastoral_pipeline_columns(id),
  member_id uuid REFERENCES members(id),
  visitor_name text,
  phone text,
  email text,
  attendance_type text NOT NULL DEFAULT 'visita_pastoral',
  responsible_user_id uuid REFERENCES users(id),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','doing','done','cancelled')),
  title text,
  sla_date timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  is_starred boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_church_id ON pastoral_attendances(church_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_column_id ON pastoral_attendances(column_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_member_id ON pastoral_attendances(member_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_responsible ON pastoral_attendances(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_status ON pastoral_attendances(status);
CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_created_at ON pastoral_attendances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastoral_attendances_church_status ON pastoral_attendances(church_id, status);

-- 5. Atividades dos atendimentos
CREATE TABLE IF NOT EXISTS pastoral_attendance_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES pastoral_attendances(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'task',
  title text NOT NULL,
  description text,
  scheduled_date timestamptz,
  duration_minutes integer,
  responsible_user_id uuid REFERENCES users(id),
  meeting_link text,
  location text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  priority text NOT NULL DEFAULT 'normal',
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pastoral_activities_attendance_id ON pastoral_attendance_activities(attendance_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_activities_church_id ON pastoral_attendance_activities(church_id);

-- 6. Notas dos atendimentos
CREATE TABLE IF NOT EXISTS pastoral_attendance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES pastoral_attendances(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pastoral_notes_attendance_id ON pastoral_attendance_notes(attendance_id);

-- 7. Timeline/histórico dos atendimentos
CREATE TABLE IF NOT EXISTS pastoral_attendance_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES pastoral_attendances(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'created','moved','note','activity','call','whatsapp','email','meeting','status_changed'
  description text NOT NULL,
  metadata jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastoral_timeline_attendance_id ON pastoral_attendance_timeline(attendance_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_timeline_church_id ON pastoral_attendance_timeline(church_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_timeline_created_at ON pastoral_attendance_timeline(created_at DESC);

-- 8. Arquivos dos atendimentos
CREATE TABLE IF NOT EXISTS pastoral_attendance_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES pastoral_attendances(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 9. Tags globais
CREATE TABLE IF NOT EXISTS pastoral_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers de updated_at
DROP TRIGGER IF EXISTS trg_pastoral_pipelines_updated_at ON pastoral_pipelines;
CREATE TRIGGER trg_pastoral_pipelines_updated_at
  BEFORE UPDATE ON pastoral_pipelines
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastoral_pipeline_columns_updated_at ON pastoral_pipeline_columns;
CREATE TRIGGER trg_pastoral_pipeline_columns_updated_at
  BEFORE UPDATE ON pastoral_pipeline_columns
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastoral_attendances_updated_at ON pastoral_attendances;
CREATE TRIGGER trg_pastoral_attendances_updated_at
  BEFORE UPDATE ON pastoral_attendances
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastoral_activities_updated_at ON pastoral_attendance_activities;
CREATE TRIGGER trg_pastoral_activities_updated_at
  BEFORE UPDATE ON pastoral_attendance_activities
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pastoral_notes_updated_at ON pastoral_attendance_notes;
CREATE TRIGGER trg_pastoral_notes_updated_at
  BEFORE UPDATE ON pastoral_attendance_notes
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- RLS
ALTER TABLE pastoral_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_pipeline_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_column_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_attendance_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_attendance_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_attendance_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_attendance_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS church_scope_pastoral_pipelines ON pastoral_pipelines;
CREATE POLICY church_scope_pastoral_pipelines ON pastoral_pipelines
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_pipeline_columns ON pastoral_pipeline_columns;
CREATE POLICY church_scope_pastoral_pipeline_columns ON pastoral_pipeline_columns
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_column_types ON pastoral_column_types;
CREATE POLICY church_scope_pastoral_column_types ON pastoral_column_types
  FOR ALL USING (true);

DROP POLICY IF EXISTS church_scope_pastoral_attendances ON pastoral_attendances;
CREATE POLICY church_scope_pastoral_attendances ON pastoral_attendances
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_activities ON pastoral_attendance_activities;
CREATE POLICY church_scope_pastoral_activities ON pastoral_attendance_activities
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_notes ON pastoral_attendance_notes;
CREATE POLICY church_scope_pastoral_notes ON pastoral_attendance_notes
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_timeline ON pastoral_attendance_timeline;
CREATE POLICY church_scope_pastoral_timeline ON pastoral_attendance_timeline
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_files ON pastoral_attendance_files;
CREATE POLICY church_scope_pastoral_files ON pastoral_attendance_files
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

DROP POLICY IF EXISTS church_scope_pastoral_tags ON pastoral_tags;
CREATE POLICY church_scope_pastoral_tags ON pastoral_tags
  FOR ALL USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());

-- Seed: cria pipeline padrão via função para novas igrejas (opcional)
-- As igrejas existentes precisarão ter o pipeline criado via UI ou seed script
