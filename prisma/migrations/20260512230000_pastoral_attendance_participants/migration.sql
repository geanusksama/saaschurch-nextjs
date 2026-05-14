-- Participantes dos atendimentos pastorais
-- Permite registrar múltiplas pessoas envolvidas em cada atendimento
-- (pastores, membros atendidos, líderes de célula, etc.)

CREATE TABLE IF NOT EXISTS pastoral_attendance_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES pastoral_attendances(id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  user_id uuid REFERENCES users(id),
  -- 'atendido' | 'pastor' | 'lider' | 'testemunha' | 'visitante'
  role text NOT NULL DEFAULT 'atendido',
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pastoral_participants_attendance ON pastoral_attendance_participants(attendance_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_participants_member ON pastoral_attendance_participants(member_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_participants_church ON pastoral_attendance_participants(church_id);

-- RLS
ALTER TABLE pastoral_attendance_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pastoral_participants_church_select"
  ON pastoral_attendance_participants FOR SELECT
  USING (church_id = app.current_church_id());

CREATE POLICY "pastoral_participants_church_insert"
  ON pastoral_attendance_participants FOR INSERT
  WITH CHECK (church_id = app.current_church_id());

CREATE POLICY "pastoral_participants_church_delete"
  ON pastoral_attendance_participants FOR DELETE
  USING (church_id = app.current_church_id());
