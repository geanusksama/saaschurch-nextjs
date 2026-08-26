-- Pipelines do módulo Secretaria (kan_pipelines). Sem dependência de outra
-- tabela. IDs fixos (não são autoincrement na origem) — necessário manter,
-- pois kan_stages referencia estes IDs diretamente.

INSERT INTO "kan_pipelines" ("id", "name", "type", "hash", "campo", "is_active") VALUES (1, 'Secretaria', 'Serviços', 'abc123xyz', 'campinas', TRUE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_pipelines" ("id", "name", "type", "hash", "campo", "is_active") VALUES (2, 'Evento', 'Eventos diversos', 'abc123xyz2', 'campinas', TRUE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_pipelines" ("id", "name", "type", "hash", "campo", "is_active") VALUES (4, 'Tesouraria', 'Tesouraria', 'abc123xyz', 'campinas', TRUE) ON CONFLICT (id) DO NOTHING;
