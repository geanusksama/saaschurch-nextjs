-- Gestão de Culto — tipos de culto como cadastro real, e observação no envio.
--
-- Migration ADITIVA: cria uma tabela nova e adiciona uma coluna anulável em
-- culto_lancamentos (tabela criada hoje, sem volume).
--
-- 1. tipo_culto: o "tipo" era texto livre digitado à mão em cada lançamento.
--    A regra do sistema é que TODO dropdown tenha cadastro em Configurações ›
--    Listas e Cadastros Auxiliares (ver src/lib/lookupRegistry.ts), para a
--    igreja criar, renomear e desativar opção sem depender de deploy. Segue o
--    mesmo formato de bancos/departamentos, inclusive o isolamento por campo.
--
-- 2. culto_lancamentos.observacao: quem lança precisa poder explicar o número
--    ("oferta do sábado veio junto", "faltou o culto da manhã") e o dirigente
--    precisa ler isso antes de aprovar. O campo `texto` já existia mas é o
--    conteúdo do bloco EXTRA — misturar os dois deixaria a observação do
--    tesoureiro dentro de um bloco que não é dele.

CREATE TABLE IF NOT EXISTS "tipo_culto" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "campo_id"   UUID,
    -- Gravado no registro do culto (estável; o nome pode ser renomeado depois).
    "codigo"     VARCHAR(60) NOT NULL,
    "nome"       VARCHAR(120) NOT NULL,
    "descricao"  TEXT,
    "ordem"      INTEGER NOT NULL DEFAULT 0,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    -- Pré-selecionado no formulário de lançamento.
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tipo_culto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tipo_culto_campo_id_idx" ON "tipo_culto" ("campo_id");
CREATE INDEX IF NOT EXISTS "tipo_culto_ativo_idx" ON "tipo_culto" ("ativo");
CREATE UNIQUE INDEX IF NOT EXISTS "tipo_culto_codigo_unico"
    ON "tipo_culto" ("campo_id", "codigo") WHERE "deleted_at" IS NULL;

ALTER TABLE "tipo_culto"
    ADD CONSTRAINT "tipo_culto_campo_id_fkey" FOREIGN KEY ("campo_id")
    REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Observação do lançador, lida por quem aprova.
ALTER TABLE "culto_lancamentos" ADD COLUMN IF NOT EXISTS "observacao" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Semente: os tipos que já existem hoje nos registros, mais os cultos comuns.
-- Um por campo, porque a tabela é isolada por campo_id.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "tipo_culto" ("campo_id", "codigo", "nome", "ordem", "is_default")
SELECT c.id, t.codigo, t.nome, t.ordem, t.is_default
FROM "campos" c
CROSS JOIN (VALUES
    ('CULTO',       'Culto',                   1, true),
    ('EBD',         'EBD (Escola Bíblica)',    2, false),
    ('ORACAO',      'Culto de oração',         3, false),
    ('JOVENS',      'Culto de jovens',         4, false),
    ('MULHERES',    'Culto de senhoras',       5, false),
    ('INFANTIL',    'Culto infantil',          6, false),
    ('SANTA_CEIA',  'Santa Ceia',              7, false),
    ('EVANGELISMO', 'Culto evangelístico',     8, false),
    ('VIGILIA',     'Vigília',                 9, false),
    ('ESPECIAL',    'Culto especial',         10, false)
) AS t(codigo, nome, ordem, is_default)
WHERE c.deleted_at IS NULL
ON CONFLICT DO NOTHING;
