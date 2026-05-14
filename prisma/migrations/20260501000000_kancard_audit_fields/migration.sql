-- Add missing audit/process fields to kan_cards

ALTER TABLE kan_cards
  ADD COLUMN IF NOT EXISTS origin_regional_id       UUID REFERENCES regionais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_regional_id  UUID REFERENCES regionais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requester_church_id      UUID REFERENCES churches(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_church_id      UUID REFERENCES churches(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requester_name           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subject                  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS observations             TEXT,
  ADD COLUMN IF NOT EXISTS description              TEXT,
  ADD COLUMN IF NOT EXISTS approved_by              UUID,
  ADD COLUMN IF NOT EXISTS approved_at              TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_kan_cards_origin_regional ON kan_cards(origin_regional_id);
CREATE INDEX IF NOT EXISTS idx_kan_cards_dest_regional   ON kan_cards(destination_regional_id);
CREATE INDEX IF NOT EXISTS idx_kan_cards_requester_church ON kan_cards(requester_church_id);
