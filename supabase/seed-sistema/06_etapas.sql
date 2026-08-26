-- Etapas do pipeline (kan_stages). Depende de kan_pipelines (pipeline_id,
-- obrigatório) e kan_services (service_id, opcional). Rode DEPOIS de 04 e 05.

INSERT INTO "kan_stages" ("id", "pipeline_id", "service_id", "name", "description", "author", "campo", "hash") VALUES (1, 1, 3, 'Batismo', 'Pipeline de Batismo', 'Francisco', 'campinas', 'abc123xyz') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_stages" ("id", "pipeline_id", "service_id", "name", "description", "author", "campo", "hash") VALUES (2, 1, 28, 'Transferência', 'Pipeline de Transferência', 'Eu', 'campinas', 'abc123xyz') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_stages" ("id", "pipeline_id", "service_id", "name", "description", "author", "campo", "hash") VALUES (3, 1, 4, 'Cadastro', 'Pipeline de Cadastro', 'eu', 'campinas', 'abc123xyz') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_stages" ("id", "pipeline_id", "service_id", "name", "description", "author", "campo", "hash") VALUES (4, 1, NULL, 'Requerimento', 'Pipeline de Requerimentos', 'Francisco', 'campinas', 'abc123xyz') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_stages" ("id", "pipeline_id", "service_id", "name", "description", "author", "campo", "hash") VALUES (5, 1, NULL, 'Consagração', 'Pipeline de Consagração', 'Francisco', 'campinas', 'abc123xyz') ON CONFLICT (id) DO NOTHING;
