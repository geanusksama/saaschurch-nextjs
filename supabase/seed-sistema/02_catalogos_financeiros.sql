-- Listas auxiliares do módulo Contas a Pagar (tipos_credor, naturezas_despesa,
-- tipos_departamento, tipos_conta_bancaria). Sem dependência de nenhuma outra
-- tabela — mesmo conteúdo padrão que já roda em produção
-- (prisma/migrations/20260812130000_listas_contas_a_pagar). Ponto de partida
-- editável pela tela de Configurações › Listas e Cadastros Auxiliares, não é
-- regra fixa de código.

INSERT INTO "tipos_credor" ("codigo", "nome", "ordem", "is_default") VALUES
    ('PASTOR',        'Pastor',                1, false),
    ('OBREIRO',       'Obreiro',               2, false),
    ('FORNECEDOR',    'Fornecedor',            3, true),
    ('PRESTADOR',     'Prestador de serviço',  4, false),
    ('ORGAO_PUBLICO', 'Órgão público',         5, false),
    ('OUTRO',         'Outro',                 6, false)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "naturezas_despesa" ("codigo", "nome", "descricao", "ordem", "is_default") VALUES
    ('FIXA',     'Fixa',     'Repete todo mês com valor previsível (aluguel, folha).', 1, false),
    ('VARIAVEL', 'Variável', 'Repete, mas o valor muda (água, luz, telefone).',        2, true),
    ('EVENTUAL', 'Eventual', 'Não tem periodicidade (reforma, evento).',               3, false)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "tipos_departamento" ("codigo", "nome", "ordem", "is_default") VALUES
    ('GERAL',      'Geral',      1, true),
    ('MINISTERIO', 'Ministério', 2, false),
    ('CAMPANHA',   'Campanha',   3, false),
    ('SETOR',      'Setor',      4, false),
    ('OBRA',       'Obra',       5, false),
    ('MISSOES',    'Missões',    6, false)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "tipos_conta_bancaria" ("codigo", "nome", "ordem", "is_default") VALUES
    ('CORRENTE',      'Conta corrente',  1, true),
    ('POUPANCA',      'Poupança',        2, false),
    ('CAIXA_ESPECIE', 'Caixa (espécie)', 3, false),
    ('APLICACAO',     'Aplicação',       4, false)
ON CONFLICT ("codigo") DO NOTHING;
