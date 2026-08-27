-- Gestão de Culto — fechamento pós-culto com aprovação em cascata.
-- Ver docs/modules/gestao-culto/SPEC.md.
--
-- Migration ADITIVA: só CREATE TABLE / CREATE INDEX. Nenhuma tabela existente
-- é alterada. Em especial livro_caixa (331 mil linhas) não é tocada — o
-- fechamento do culto é controle gerencial e não substitui o lançamento
-- contábil (decisão D4 da SPEC).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. culto_posicoes — quem ocupa qual papel neste fluxo
--    Anexa USUÁRIO, não membro: quem envia e quem aprova precisa logar.
--    church_function_history anexa member_id e por isso não serve (D1).
--    Medido em 27/08/2026: churches.lead_pastor_id está NULL em 126/126
--    igrejas, ou seja, hoje não há como saber quem é o dirigente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "culto_posicoes" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "campo_id"   UUID NOT NULL,
    -- NULL apenas para PRESIDENTE, que vale para o campo inteiro.
    "church_id"  UUID,
    "user_id"    UUID NOT NULL,
    -- FINANCEIRO | PRESENCA | EXTRA | APROVADOR_LOCAL | APROVADOR_HOSPEDEIRA | PRESIDENTE
    "papel"      VARCHAR(30) NOT NULL,
    "titulo"     VARCHAR(120),
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,

    CONSTRAINT "culto_posicoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "culto_posicoes_campo_id_idx"        ON "culto_posicoes" ("campo_id");
CREATE INDEX IF NOT EXISTS "culto_posicoes_church_id_papel_idx" ON "culto_posicoes" ("church_id", "papel");
CREATE INDEX IF NOT EXISTS "culto_posicoes_user_id_idx"         ON "culto_posicoes" ("user_id");

-- Mais de uma pessoa no mesmo papel é permitido de propósito (suplente que
-- também aprova). O que não pode é a MESMA pessoa duplicada no mesmo papel.
CREATE UNIQUE INDEX IF NOT EXISTS "culto_posicoes_unica"
    ON "culto_posicoes" ("church_id", "user_id", "papel")
    WHERE "deleted_at" IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. culto_registros — o culto de uma igreja num dia
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "culto_registros" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "campo_id"       UUID NOT NULL,
    "regional_id"    UUID,
    "church_id"      UUID NOT NULL,
    -- Congelado na abertura: quando a igreja for anexada a uma hospedeira (ou
    -- trocar de hospedeira), o culto de hoje continua contando para a
    -- hospedeira certa. Mesmo princípio de church_leader_history.distance_km.
    "host_church_id" UUID,
    "data_culto"     DATE NOT NULL,
    "tipo_culto"     VARCHAR(60) NOT NULL DEFAULT 'CULTO',
    -- ABERTO | AGUARDANDO_LOCAL | APROVADO_LOCAL | CONCLUIDO | REJEITADO
    "status"         VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
    "observacao"     TEXT,
    "concluido_em"   TIMESTAMPTZ,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"     TIMESTAMPTZ,
    "created_by"     UUID,

    CONSTRAINT "culto_registros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "culto_registros_church_id_data_culto_tipo_culto_key"
    ON "culto_registros" ("church_id", "data_culto", "tipo_culto");

CREATE INDEX IF NOT EXISTS "culto_registros_campo_id_data_culto_idx" ON "culto_registros" ("campo_id", "data_culto");
CREATE INDEX IF NOT EXISTS "culto_registros_status_idx"              ON "culto_registros" ("status");
CREATE INDEX IF NOT EXISTS "culto_registros_host_church_id_idx"      ON "culto_registros" ("host_church_id");
CREATE INDEX IF NOT EXISTS "culto_registros_regional_id_idx"         ON "culto_registros" ("regional_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. culto_lancamentos — um por bloco
--    Colunas tipadas em vez de JSONB: estes números viram SUM() por período
--    nos relatórios da etapa seguinte (D5).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "culto_lancamentos" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "registro_id" UUID NOT NULL,
    -- FINANCEIRO | PRESENCA | EXTRA
    "bloco"       VARCHAR(20) NOT NULL,
    "enviado_por" UUID,
    "enviado_em"  TIMESTAMPTZ,

    -- bloco FINANCEIRO
    "total_dizimos" DECIMAL(15,2),
    "total_ofertas" DECIMAL(15,2),
    "qtd_dizimos"   INTEGER,
    "qtd_ofertas"   INTEGER,

    -- bloco PRESENCA
    "qtd_homens"         INTEGER,
    "qtd_mulheres"       INTEGER,
    "qtd_jovens"         INTEGER,
    "qtd_adolescentes"   INTEGER,
    "qtd_criancas"       INTEGER,
    "qtd_visitantes"     INTEGER,
    "qtd_conversoes"     INTEGER,
    "qtd_reconciliacoes" INTEGER,
    "qtd_familias"       INTEGER,
    "cadeiras_vazias"    INTEGER,

    -- bloco EXTRA
    "texto"     TEXT,
    "anexo_url" VARCHAR(500),

    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "culto_lancamentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "culto_lancamentos_registro_id_bloco_key"
    ON "culto_lancamentos" ("registro_id", "bloco");
CREATE INDEX IF NOT EXISTS "culto_lancamentos_enviado_por_idx" ON "culto_lancamentos" ("enviado_por");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. culto_aprovacoes — a decisão viva de cada nível
--    O histórico completo (quem aprovou, quando, de onde) fica em audit_logs,
--    gravado automaticamente pelo withAuth em toda mutação.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "culto_aprovacoes" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "registro_id"  UUID NOT NULL,
    -- LOCAL | HOSPEDEIRA
    "nivel"        VARCHAR(20) NOT NULL,
    -- APROVADO | REJEITADO
    "decisao"      VARCHAR(20) NOT NULL,
    "aprovador_id" UUID,
    -- Obrigatório quando REJEITADO: é o que o dirigente devolve para correção.
    "motivo"       TEXT,
    "decidido_em"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "culto_aprovacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "culto_aprovacoes_registro_id_nivel_key"
    ON "culto_aprovacoes" ("registro_id", "nivel");
CREATE INDEX IF NOT EXISTS "culto_aprovacoes_aprovador_id_idx" ON "culto_aprovacoes" ("aprovador_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Chaves estrangeiras
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "culto_posicoes"
    ADD CONSTRAINT "culto_posicoes_campo_id_fkey"   FOREIGN KEY ("campo_id")   REFERENCES "campos"("id")   ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_posicoes_church_id_fkey"  FOREIGN KEY ("church_id")  REFERENCES "churches"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_posicoes_user_id_fkey"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")    ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_posicoes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id")    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "culto_registros"
    ADD CONSTRAINT "culto_registros_campo_id_fkey"       FOREIGN KEY ("campo_id")       REFERENCES "campos"("id")    ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_registros_regional_id_fkey"    FOREIGN KEY ("regional_id")    REFERENCES "regionais"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_registros_church_id_fkey"      FOREIGN KEY ("church_id")      REFERENCES "churches"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_registros_host_church_id_fkey" FOREIGN KEY ("host_church_id") REFERENCES "churches"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_registros_created_by_fkey"     FOREIGN KEY ("created_by")     REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "culto_lancamentos"
    ADD CONSTRAINT "culto_lancamentos_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "culto_registros"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_lancamentos_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "users"("id")           ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "culto_aprovacoes"
    ADD CONSTRAINT "culto_aprovacoes_registro_id_fkey"  FOREIGN KEY ("registro_id")  REFERENCES "culto_registros"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    ADD CONSTRAINT "culto_aprovacoes_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "users"("id")           ON DELETE SET NULL ON UPDATE CASCADE;
