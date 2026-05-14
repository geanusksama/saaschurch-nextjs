-- Add service_group to kan_services
ALTER TABLE kan_services ADD COLUMN IF NOT EXISTS service_group VARCHAR(60);

-- Add service_group and action to member_occurrences
ALTER TABLE member_occurrences ADD COLUMN IF NOT EXISTS service_group VARCHAR(60);
ALTER TABLE member_occurrences ADD COLUMN IF NOT EXISTS action VARCHAR(120);

-- Create member_event_history table
CREATE TABLE IF NOT EXISTS member_event_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  card_id       UUID REFERENCES kan_cards(id) ON DELETE SET NULL,
  church_id     UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_group VARCHAR(60),
  service_name  VARCHAR(255),
  column_index  INT,
  action        VARCHAR(120),
  notes         TEXT,
  metadata      JSONB,
  created_by    UUID,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meh_member  ON member_event_history(member_id);
CREATE INDEX IF NOT EXISTS idx_meh_church  ON member_event_history(church_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meh_card    ON member_event_history(card_id);
