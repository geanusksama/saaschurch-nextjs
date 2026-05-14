-- Add stage_id to kan_matrix_rules (links each rule to the stage/artefato it belongs to)
ALTER TABLE kan_matrix_rules ADD COLUMN stage_id INTEGER REFERENCES kan_stages(id);
CREATE INDEX kan_matrix_rules_stage_id_idx ON kan_matrix_rules(stage_id);
