-- Catálogo de serviços da Secretaria (kan_services). Sem dependência de
-- outra tabela. IDs fixos, referenciados por kan_stages e kan_matrix_rules.

INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (1, 'ADMINM', 'Admissao de Membros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (2, 'ADMINOB', 'Admissao de Obreiros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (3, 'BAT', 'Batismo (em outro Ministério)', 'Batismo (em outro Ministério)', FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (4, 'CAD', 'Cadastro', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (5, 'CDIACNO', 'Consagração a Diácono', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (6, 'CDIACSA', 'Consagração a Diaconisa', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (7, 'CDM', 'Carta de Mudança', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (8, 'CONEV', 'Consagração a Evangelista', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (9, 'CONPR', 'Consagração a Pastor', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (10, 'CONSPRESB', 'Consagração a Presbítero', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (11, 'DESCR', 'Descredenciamento de Cargo - Evangelista (Mulher)', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (12, 'DESCRH', 'Descredenciamento de Cargo - Evangelista (Homem)', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (13, 'DESCRPH', 'Descredenciamento de Cargo - Pastor', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (14, 'DESLMEM', 'Desligamento de Membros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (15, 'DESlMIN', 'Desligamento de Ministros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (16, 'DESLOBRE', 'Desligamento de Obreiros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (17, 'EXCL', 'Exclusão de Membros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (18, 'FALE', 'Falecimento', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (19, 'READMEM', 'Readmissao de Membros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (20, 'READOBR', 'Readmissão de Obreiros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (21, 'READOMN', 'Readmissão de Ministros', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (22, 'RECEV', 'Reconhecimento de Cargo - Evangelista', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (23, 'RECPR', 'Reconhecimento de Cargo - Pastor', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (24, 'RECMS', 'Reconhecimento de Cargo - Missionaria', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (25, 'RECONPB', 'Reconhecimento de Cargo - Presbitero', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (26, 'SCOOP', 'Separação a Cooperador', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (27, 'SCOOPA', 'Separação a Cooperadora', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (28, 'TRANSFERENCIA', 'Transferência', 'Transferencia', TRUE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (29, 'BATISMO', 'Batismo em Águas', 'Batismo em águas', TRUE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (30, 'CONMISSF', 'Consagração a Missionária', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (31, 'CONMISSM', 'Consagração a Missionário', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO "kan_services" ("id", "sigla", "description", "servico", "uses_matrix") VALUES (32, 'CONPRF', 'Consagração a Pastora', NULL, FALSE) ON CONFLICT (id) DO NOTHING;
