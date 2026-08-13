-- Módulo Contas a Pagar + cadastros de Bancos e Departamentos.
--
-- Migration ADITIVA: só cria tabelas novas e adiciona duas colunas ANULÁVEIS em
-- livro_caixa. Nenhuma coluna existente muda de tipo, nada é apagado.
--
-- Sobre livro_caixa (331 mil linhas): ADD COLUMN anulável e sem DEFAULT não
-- reescreve a tabela no Postgres — é uma alteração de catálogo, instantânea.
-- Os lançamentos históricos ficam com banco_id/departamento_id em NULL de
-- propósito: carimbar um valor inventado em cima de dado contábil antigo seria
-- fabricar informação. A UI mostra esses casos como "Não informado".

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Cadastros auxiliares: bancos e departamentos
--    Seguem o padrão dos lookups já existentes (plano_de_contas,
--    forma_pagamento, centro_de_custo): registros globais, church_id anulável
--    reservado para escopo por igreja no futuro.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "bancos" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome"       VARCHAR(150) NOT NULL,
    "codigo"     VARCHAR(10),
    "agencia"    VARCHAR(20),
    "conta"      VARCHAR(30),
    -- CORRENTE | POUPANCA | CAIXA_ESPECIE | APLICACAO
    "tipo_conta" VARCHAR(30),
    "chave_pix"  VARCHAR(255),
    "titular"    VARCHAR(255),
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    -- Pré-selecionado nos lançamentos novos.
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "church_id"  UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bancos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bancos_ativo_idx" ON "bancos" ("ativo");
CREATE INDEX IF NOT EXISTS "bancos_church_id_idx" ON "bancos" ("church_id");

DO $$ BEGIN
    ALTER TABLE "bancos"
        ADD CONSTRAINT "bancos_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


CREATE TABLE IF NOT EXISTS "departamentos" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome"       VARCHAR(150) NOT NULL,
    "codigo"     VARCHAR(20),
    -- MINISTERIO | CAMPANHA | SETOR | OBRA | MISSOES | GERAL
    "tipo"       VARCHAR(30),
    "descricao"  TEXT,
    "cor"        VARCHAR(7),
    "ordem"      INTEGER NOT NULL DEFAULT 0,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "church_id"  UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "departamentos_ativo_idx" ON "departamentos" ("ativo");
CREATE INDEX IF NOT EXISTS "departamentos_church_id_idx" ON "departamentos" ("church_id");

DO $$ BEGIN
    ALTER TABLE "departamentos"
        ADD CONSTRAINT "departamentos_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. livro_caixa ganha banco e departamento
--    ON DELETE SET NULL: apagar um cadastro auxiliar nunca pode apagar o
--    lançamento contábil que apontava para ele.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "livro_caixa" ADD COLUMN IF NOT EXISTS "banco_id" UUID;
ALTER TABLE "livro_caixa" ADD COLUMN IF NOT EXISTS "departamento_id" UUID;

CREATE INDEX IF NOT EXISTS "livro_caixa_banco_id_idx" ON "livro_caixa" ("banco_id");
CREATE INDEX IF NOT EXISTS "livro_caixa_departamento_id_idx" ON "livro_caixa" ("departamento_id");

DO $$ BEGIN
    ALTER TABLE "livro_caixa"
        ADD CONSTRAINT "livro_caixa_banco_id_fkey"
        FOREIGN KEY ("banco_id") REFERENCES "bancos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "livro_caixa"
        ADD CONSTRAINT "livro_caixa_departamento_id_fkey"
        FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tipos de despesa (categorias)
--    Não duplica o plano de contas: referencia o existente por plano_de_conta_id
--    para que o relatório gerencial e o contábil batam.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tipos_despesa" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id"         UUID NOT NULL,
    "nome"              VARCHAR(150) NOT NULL,
    "categoria_pai_id"  UUID,
    -- FIXA | VARIAVEL | EVENTUAL
    "natureza"          VARCHAR(20) NOT NULL DEFAULT 'VARIAVEL',
    "departamento_id"   UUID,
    "plano_de_conta_id" UUID,
    "ativo"             BOOLEAN NOT NULL DEFAULT true,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"        TIMESTAMPTZ,

    CONSTRAINT "tipos_despesa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tipos_despesa_church_id_idx" ON "tipos_despesa" ("church_id");
CREATE INDEX IF NOT EXISTS "tipos_despesa_categoria_pai_id_idx" ON "tipos_despesa" ("categoria_pai_id");

DO $$ BEGIN
    ALTER TABLE "tipos_despesa"
        ADD CONSTRAINT "tipos_despesa_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "tipos_despesa"
        ADD CONSTRAINT "tipos_despesa_categoria_pai_id_fkey"
        FOREIGN KEY ("categoria_pai_id") REFERENCES "tipos_despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "tipos_despesa"
        ADD CONSTRAINT "tipos_despesa_departamento_id_fkey"
        FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Credores / beneficiários
--    member_id liga o credor ao cadastro de membro quando ele é um (pastor,
--    obreiro), para que o extrato por credor case com o perfil da pessoa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "credores" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id"    UUID NOT NULL,
    "nome"         VARCHAR(255) NOT NULL,
    -- PF | PJ
    "tipo_pessoa"  VARCHAR(10) NOT NULL DEFAULT 'PF',
    "cpf_cnpj"     VARCHAR(20),
    -- PASTOR | OBREIRO | FORNECEDOR | PRESTADOR | ORGAO_PUBLICO | OUTRO
    "tipo_credor"  VARCHAR(30) NOT NULL DEFAULT 'FORNECEDOR',
    "member_id"    UUID,
    "banco_id"     UUID,
    "banco_nome"   VARCHAR(150),
    "agencia"      VARCHAR(20),
    "conta"        VARCHAR(30),
    "tipo_conta"   VARCHAR(30),
    "chave_pix"    VARCHAR(255),
    "telefone"     VARCHAR(30),
    "email"        VARCHAR(255),
    "observacoes"  TEXT,
    "ativo"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"   TIMESTAMPTZ,

    CONSTRAINT "credores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "credores_church_id_idx" ON "credores" ("church_id");
CREATE INDEX IF NOT EXISTS "credores_member_id_idx" ON "credores" ("member_id");

DO $$ BEGIN
    ALTER TABLE "credores"
        ADD CONSTRAINT "credores_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "credores"
        ADD CONSTRAINT "credores_member_id_fkey"
        FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "credores"
        ADD CONSTRAINT "credores_banco_id_fkey"
        FOREIGN KEY ("banco_id") REFERENCES "bancos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Contas a pagar (o título — registro-mãe)
--    status_geral é DERIVADO das parcelas (nunca editado à mão pelo usuário).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "contas_pagar" (
    "id"                        UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id"                 UUID NOT NULL,
    "numero"                    VARCHAR(30) NOT NULL,
    "tipo_despesa_id"           UUID,
    "credor_id"                 UUID,
    "departamento_id"           UUID,
    "banco_id"                  UUID,
    "descricao"                 VARCHAR(500) NOT NULL,
    "valor_total"               DECIMAL(15,2) NOT NULL,
    "data_emissao"              DATE NOT NULL,
    "forma_pagamento_prevista"  VARCHAR(30),
    "numero_documento"          VARCHAR(100),
    "recorrente"                BOOLEAN NOT NULL DEFAULT false,
    "parcelado"                 BOOLEAN NOT NULL DEFAULT false,
    "numero_parcelas"           INTEGER NOT NULL DEFAULT 1,
    -- PENDENTE | PARCIAL | PAGO | ATRASADO | CANCELADA — derivado das parcelas
    "status_geral"              VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    -- NAO_REQUER | AGUARDANDO | APROVADO | REPROVADO
    "status_aprovacao"          VARCHAR(20) NOT NULL DEFAULT 'NAO_REQUER',
    "aprovado_por"              UUID,
    "data_aprovacao"            TIMESTAMPTZ,
    "motivo_reprovacao"         TEXT,
    "anexo_documento_url"       VARCHAR(500),
    "observacoes"               TEXT,
    "criado_por"                UUID,
    "created_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"                TIMESTAMPTZ,

    CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contas_pagar_church_numero_key" ON "contas_pagar" ("church_id", "numero");
CREATE INDEX IF NOT EXISTS "contas_pagar_church_status_idx" ON "contas_pagar" ("church_id", "status_geral");
CREATE INDEX IF NOT EXISTS "contas_pagar_credor_id_idx" ON "contas_pagar" ("credor_id");
CREATE INDEX IF NOT EXISTS "contas_pagar_tipo_despesa_id_idx" ON "contas_pagar" ("tipo_despesa_id");
CREATE INDEX IF NOT EXISTS "contas_pagar_departamento_id_idx" ON "contas_pagar" ("departamento_id");
CREATE INDEX IF NOT EXISTS "contas_pagar_data_emissao_idx" ON "contas_pagar" ("church_id", "data_emissao");

DO $$ BEGIN
    ALTER TABLE "contas_pagar"
        ADD CONSTRAINT "contas_pagar_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "contas_pagar"
        ADD CONSTRAINT "contas_pagar_tipo_despesa_id_fkey"
        FOREIGN KEY ("tipo_despesa_id") REFERENCES "tipos_despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "contas_pagar"
        ADD CONSTRAINT "contas_pagar_credor_id_fkey"
        FOREIGN KEY ("credor_id") REFERENCES "credores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "contas_pagar"
        ADD CONSTRAINT "contas_pagar_departamento_id_fkey"
        FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "contas_pagar"
        ADD CONSTRAINT "contas_pagar_banco_id_fkey"
        FOREIGN KEY ("banco_id") REFERENCES "bancos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Parcelas — o coração do módulo
--    valor_pago e valor_saldo são SEMPRE recalculados a partir dos pagamentos.
--    Nenhuma rota grava esses campos direto.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "parcelas_contas_pagar" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id"       UUID NOT NULL,
    "conta_pagar_id"  UUID NOT NULL,
    "numero_parcela"  INTEGER NOT NULL,
    "total_parcelas"  INTEGER NOT NULL DEFAULT 1,
    "valor_parcela"   DECIMAL(15,2) NOT NULL,
    "valor_pago"      DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valor_saldo"     DECIMAL(15,2) NOT NULL DEFAULT 0,
    "data_vencimento" DATE NOT NULL,
    -- PENDENTE | PARCIAL | PAGO | ATRASADO | CANCELADA — derivado
    "status"          VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "observacao"      TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcelas_contas_pagar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "parcelas_conta_numero_key"
    ON "parcelas_contas_pagar" ("conta_pagar_id", "numero_parcela");
CREATE INDEX IF NOT EXISTS "parcelas_church_vencimento_idx"
    ON "parcelas_contas_pagar" ("church_id", "data_vencimento");
CREATE INDEX IF NOT EXISTS "parcelas_church_status_idx"
    ON "parcelas_contas_pagar" ("church_id", "status");

DO $$ BEGIN
    ALTER TABLE "parcelas_contas_pagar"
        ADD CONSTRAINT "parcelas_contas_pagar_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "parcelas_contas_pagar"
        ADD CONSTRAINT "parcelas_contas_pagar_conta_pagar_id_fkey"
        FOREIGN KEY ("conta_pagar_id") REFERENCES "contas_pagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Pagamentos da parcela
--    Uma parcela guarda uma COLEÇÃO de pagamentos (o pastor pago 60% em um mês
--    e o resto meses depois são dois registros aqui, na MESMA parcela).
--    livro_caixa_id fecha o vínculo com a baixa contábil.
--    Estorno é lógico (estornado_em) — pagamento nunca some do histórico.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "pagamentos_parcela" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id"       UUID NOT NULL,
    "parcela_id"      UUID NOT NULL,
    "valor_pago"      DECIMAL(15,2) NOT NULL,
    "data_pagamento"  DATE NOT NULL,
    "forma_pagamento" VARCHAR(30),
    "banco_id"        UUID,
    "comprovante_url" VARCHAR(500),
    "observacao"      TEXT,
    "livro_caixa_id"  UUID,
    "registrado_por"  UUID,
    "estornado_em"    TIMESTAMPTZ,
    "estornado_por"   UUID,
    "motivo_estorno"  TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_parcela_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pagamentos_parcela_parcela_id_idx" ON "pagamentos_parcela" ("parcela_id");
CREATE INDEX IF NOT EXISTS "pagamentos_parcela_church_data_idx" ON "pagamentos_parcela" ("church_id", "data_pagamento");

DO $$ BEGIN
    ALTER TABLE "pagamentos_parcela"
        ADD CONSTRAINT "pagamentos_parcela_church_id_fkey"
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pagamentos_parcela"
        ADD CONSTRAINT "pagamentos_parcela_parcela_id_fkey"
        FOREIGN KEY ("parcela_id") REFERENCES "parcelas_contas_pagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "pagamentos_parcela"
        ADD CONSTRAINT "pagamentos_parcela_banco_id_fkey"
        FOREIGN KEY ("banco_id") REFERENCES "bancos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sem FK para livro_caixa: o lançamento contábil pode ser removido logicamente
-- por outro fluxo e não pode arrastar o histórico de pagamento junto.


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Padrões — para que lançamento NOVO nunca nasça sem banco/departamento
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "bancos" ("nome", "tipo_conta", "ativo", "is_default")
SELECT 'Caixa (espécie)', 'CAIXA_ESPECIE', true, true
WHERE NOT EXISTS (SELECT 1 FROM "bancos" WHERE "is_default" = true);

INSERT INTO "departamentos" ("nome", "tipo", "ordem", "ativo", "is_default", "cor")
SELECT 'Geral (Igreja)', 'GERAL', 0, true, true, '#64748b'
WHERE NOT EXISTS (SELECT 1 FROM "departamentos" WHERE "is_default" = true);
