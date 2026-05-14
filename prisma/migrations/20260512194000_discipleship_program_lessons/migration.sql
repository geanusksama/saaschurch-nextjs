CREATE TABLE IF NOT EXISTS discipleship_program_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES churches(id),
  program_id uuid NOT NULL REFERENCES discipleship_programs(id) ON DELETE CASCADE,
  lesson_number integer NOT NULL,
  title text NOT NULL,
  content_summary text,
  duration_minutes integer,
  materials text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_program_lesson_number UNIQUE (program_id, lesson_number)
);

CREATE INDEX IF NOT EXISTS idx_discipleship_program_lessons_church_id ON discipleship_program_lessons(church_id);
CREATE INDEX IF NOT EXISTS idx_discipleship_program_lessons_program_id ON discipleship_program_lessons(program_id);
CREATE INDEX IF NOT EXISTS idx_discipleship_program_lessons_created_at ON discipleship_program_lessons(created_at DESC);

DROP TRIGGER IF EXISTS trg_discipleship_program_lessons_touch_updated_at ON discipleship_program_lessons;
CREATE TRIGGER trg_discipleship_program_lessons_touch_updated_at
BEFORE UPDATE ON discipleship_program_lessons
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE discipleship_program_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS church_scope_discipleship_program_lessons ON discipleship_program_lessons;
CREATE POLICY church_scope_discipleship_program_lessons
ON discipleship_program_lessons
FOR ALL
USING (app.current_church_id() IS NULL OR church_id = app.current_church_id())
WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());
