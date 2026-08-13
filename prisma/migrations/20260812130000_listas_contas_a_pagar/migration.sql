-- Listas auxiliares do módulo Contas a Pagar.
--
-- Motivo: nenhum dropdown do sistema pode ter opção fixa no código. Tudo que o
-- usuário escolhe num select precisa ter cadastro em Configurações › Listas e
-- Cadastros Auxiliares, para a igreja criar/renomear/desativar sem depender de
-- deploy.
--
-- Estas quatro listas alimentam: tipo de credor, natureza da despesa, tipo de
-- departamento e tipo de conta bancária.
--
-- `codigo` é o valor gravado nas tabelas de negócio (credores.tipo_credor,
-- tipos_despesa.natureza, departamentos.tipo, bancos.tipo_conta). O `nome` é o
-- rótulo exibido — renomear o rótulo não quebra o dado já gravado.

CREATE TABLE IF NOT EXISTS "tipos_credor" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo"     VARCHAR(30) NOT NULL,
    "nome"       VARCHAR(100) NOT NULL,
    "ordem"      INTEGER NOT NULL DEFAULT 0,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_credor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_credor_codigo_key" ON "tipos_credor" ("codigo");

CREATE TABLE IF NOT EXISTS "naturezas_despesa" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo"     VARCHAR(30) NOT NULL,
    "nome"       VARCHAR(100) NOT NULL,
    "descricao"  TEXT,
    "ordem"      INTEGER NOT NULL DEFAULT 0,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "naturezas_despesa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "naturezas_despesa_codigo_key" ON "naturezas_despesa" ("codigo");

CREATE TABLE IF NOT EXISTS "tipos_departamento" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo"     VARCHAR(30) NOT NULL,
    "nome"       VARCHAR(100) NOT NULL,
    "ordem"      INTEGER NOT NULL DEFAULT 0,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_departamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_departamento_codigo_key" ON "tipos_departamento" ("codigo");

CREATE TABLE IF NOT EXISTS "tipos_conta_bancaria" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo"     VARCHAR(30) NOT NULL,
    "nome"       VARCHAR(100) NOT NULL,
    "ordem"      INTEGER NOT NULL DEFAULT 0,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_conta_bancaria_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_conta_bancaria_codigo_key" ON "tipos_conta_bancaria" ("codigo");


-- Conteúdo inicial: é ponto de partida editável, não regra de código.
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
