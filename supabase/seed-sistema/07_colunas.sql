-- Colunas de cada etapa (kan_columns). Depende de kan_stages (stage_id,
-- obrigatório). Rode DEPOIS de 06.

INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (1, 1, 'Pendente', 1, 'purple') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (2, 1, 'Aprovado', 2, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (15, 1, 'Cancelado', 3, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (3, 2, 'Pendente', 1, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (8, 2, 'Aprovada', 2, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (9, 2, 'Cancelada', 3, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (4, 3, 'Pendente', 1, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (5, 3, 'Aprovado', 2, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (7, 3, 'Reprovado', 3, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (10, 4, 'Pendente', 1, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (11, 4, 'Finalizado', 2, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (12, 4, 'Cancelado', 3, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (6, 5, 'Pendente', 1, 'orange') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (13, 5, 'Aprovado', 2, 'green') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (14, 5, 'Documentos Aprovados', 3, 'blue') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (18, 5, 'Consagrado', 4, 'green') ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_columns" ("id", "stage_id", "name", "column_index", "color") VALUES (21, 5, 'Consagração Cancelada', 5, 'yellow') ON CONFLICT (id) DO NOTHING;
