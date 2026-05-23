-- ============================================================
-- EBD — Escola Bíblica Dominical
-- ============================================================

CREATE TABLE IF NOT EXISTS "ebd_trimestres" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"   UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "nome"       VARCHAR(100) NOT NULL,
  "ano"        INTEGER NOT NULL,
  "data_inicio" DATE NOT NULL,
  "data_fim"   DATE NOT NULL,
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ebd_trimestres_campo_id_idx" ON "ebd_trimestres"("campo_id");

CREATE TABLE IF NOT EXISTS "ebd_categorias" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"   UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "nome"       VARCHAR(100) NOT NULL,
  "descricao"  TEXT,
  "ordem"      INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ebd_categorias_campo_id_idx" ON "ebd_categorias"("campo_id");

CREATE TABLE IF NOT EXISTS "ebd_produtos" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"     UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "categoria_id" UUID NOT NULL REFERENCES "ebd_categorias"("id"),
  "trimestre_id" UUID REFERENCES "ebd_trimestres"("id"),
  "codigo"       VARCHAR(50),
  "nome"         VARCHAR(255) NOT NULL,
  "tipo"         VARCHAR(30) NOT NULL,
  "tema"         VARCHAR(255),
  "descricao"    TEXT,
  "unidade"      VARCHAR(20) NOT NULL DEFAULT 'un',
  "preco_custo"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "preco_venda"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "ativo"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"   UUID,
  "deleted_at"   TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ebd_produtos_campo_id_idx"     ON "ebd_produtos"("campo_id");
CREATE INDEX IF NOT EXISTS "ebd_produtos_categoria_id_idx" ON "ebd_produtos"("categoria_id");

CREATE TABLE IF NOT EXISTS "ebd_estoque" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"    UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "produto_id"  UUID NOT NULL REFERENCES "ebd_produtos"("id") ON DELETE CASCADE,
  "quantidade"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ebd_estoque_campo_produto_key" UNIQUE ("campo_id", "produto_id")
);
CREATE INDEX IF NOT EXISTS "ebd_estoque_campo_id_idx" ON "ebd_estoque"("campo_id");

CREATE TABLE IF NOT EXISTS "ebd_estoque_movimentos" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"       UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "produto_id"     UUID NOT NULL REFERENCES "ebd_produtos"("id") ON DELETE CASCADE,
  "tipo"           VARCHAR(20) NOT NULL,
  "quantidade"     INTEGER NOT NULL,
  "valor_unit"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "referencia"     VARCHAR(255),
  "referencia_id"  UUID,
  "observacao"     TEXT,
  "fornecedor"     VARCHAR(255),
  "num_nf"         VARCHAR(100),
  "data_movimento" DATE NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"     UUID
);
CREATE INDEX IF NOT EXISTS "ebd_estoque_movimentos_campo_id_idx"   ON "ebd_estoque_movimentos"("campo_id");
CREATE INDEX IF NOT EXISTS "ebd_estoque_movimentos_produto_id_idx" ON "ebd_estoque_movimentos"("produto_id");

CREATE TABLE IF NOT EXISTS "ebd_entradas" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"     UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "fornecedor"   VARCHAR(255),
  "num_nf"       VARCHAR(100),
  "data_entrada" DATE NOT NULL,
  "valor_total"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "observacao"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"   UUID,
  "deleted_at"   TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ebd_entradas_campo_id_idx" ON "ebd_entradas"("campo_id");

CREATE TABLE IF NOT EXISTS "ebd_entrada_itens" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "entrada_id"   UUID NOT NULL REFERENCES "ebd_entradas"("id") ON DELETE CASCADE,
  "produto_id"   UUID NOT NULL REFERENCES "ebd_produtos"("id"),
  "quantidade"   INTEGER NOT NULL,
  "valor_unit"   DECIMAL(10,2) NOT NULL,
  "valor_total"  DECIMAL(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ebd_entrada_itens_entrada_id_idx" ON "ebd_entrada_itens"("entrada_id");

CREATE TABLE IF NOT EXISTS "ebd_entregas" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"       UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "church_id"      UUID NOT NULL REFERENCES "churches"("id"),
  "trimestre_id"   UUID REFERENCES "ebd_trimestres"("id"),
  "numero_doc"     VARCHAR(50),
  "data_entrega"   DATE NOT NULL,
  "status"         VARCHAR(20) NOT NULL DEFAULT 'separando',
  "responsavel_id" UUID REFERENCES "members"("id"),
  "valor_total"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  "saldo_anterior" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "novo_saldo"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "observacao"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"     UUID,
  "deleted_at"     TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ebd_entregas_campo_id_idx"  ON "ebd_entregas"("campo_id");
CREATE INDEX IF NOT EXISTS "ebd_entregas_church_id_idx" ON "ebd_entregas"("church_id");

CREATE TABLE IF NOT EXISTS "ebd_entrega_itens" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "entrega_id"  UUID NOT NULL REFERENCES "ebd_entregas"("id") ON DELETE CASCADE,
  "produto_id"  UUID NOT NULL REFERENCES "ebd_produtos"("id"),
  "quantidade"  INTEGER NOT NULL,
  "valor_unit"  DECIMAL(10,2) NOT NULL,
  "valor_total" DECIMAL(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ebd_entrega_itens_entrega_id_idx" ON "ebd_entrega_itens"("entrega_id");

CREATE TABLE IF NOT EXISTS "ebd_financeiro" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"     UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "church_id"    UUID NOT NULL REFERENCES "churches"("id"),
  "trimestre_id" UUID REFERENCES "ebd_trimestres"("id"),
  "entrega_id"   UUID REFERENCES "ebd_entregas"("id"),
  "saldo"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ebd_financeiro_campo_church_trimestre_key" UNIQUE ("campo_id", "church_id", "trimestre_id")
);
CREATE INDEX IF NOT EXISTS "ebd_financeiro_campo_id_idx"  ON "ebd_financeiro"("campo_id");
CREATE INDEX IF NOT EXISTS "ebd_financeiro_church_id_idx" ON "ebd_financeiro"("church_id");

CREATE TABLE IF NOT EXISTS "ebd_financeiro_movimentos" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "financeiro_id"  UUID NOT NULL REFERENCES "ebd_financeiro"("id") ON DELETE CASCADE,
  "campo_id"       UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "tipo"           VARCHAR(30) NOT NULL,
  "valor"          DECIMAL(10,2) NOT NULL,
  "saldo_antes"    DECIMAL(10,2) NOT NULL,
  "saldo_depois"   DECIMAL(10,2) NOT NULL,
  "data"           DATE NOT NULL,
  "descricao"      VARCHAR(500),
  "responsavel_id" UUID REFERENCES "members"("id"),
  "observacao"     TEXT,
  "referencia_id"  UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"     UUID
);
CREATE INDEX IF NOT EXISTS "ebd_financeiro_movimentos_financeiro_id_idx" ON "ebd_financeiro_movimentos"("financeiro_id");
CREATE INDEX IF NOT EXISTS "ebd_financeiro_movimentos_campo_id_idx"      ON "ebd_financeiro_movimentos"("campo_id");

CREATE TABLE IF NOT EXISTS "ebd_historico" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"      UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "church_id"     UUID REFERENCES "churches"("id"),
  "tipo"          VARCHAR(30) NOT NULL,
  "titulo"        VARCHAR(255) NOT NULL,
  "descricao"     TEXT,
  "valor"         DECIMAL(10,2),
  "referencia_id" UUID,
  "data"          DATE NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"    UUID
);
CREATE INDEX IF NOT EXISTS "ebd_historico_campo_id_idx"  ON "ebd_historico"("campo_id");
CREATE INDEX IF NOT EXISTS "ebd_historico_church_id_idx" ON "ebd_historico"("church_id");

-- ============================================================
-- STRIPE — Integração de Pagamentos
-- ============================================================

CREATE TABLE IF NOT EXISTS "stripe_configs" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"            UUID NOT NULL UNIQUE REFERENCES "campos"("id") ON DELETE CASCADE,
  "publishable_key"     VARCHAR(255) NOT NULL,
  "secret_key_enc"      TEXT NOT NULL,
  "webhook_secret_enc"  TEXT,
  "account_id"          VARCHAR(100),
  "ativo"               BOOLEAN NOT NULL DEFAULT false,
  "modo_prod"           BOOLEAN NOT NULL DEFAULT false,
  "pix_enabled"         BOOLEAN NOT NULL DEFAULT true,
  "card_enabled"        BOOLEAN NOT NULL DEFAULT true,
  "currency"            VARCHAR(3) NOT NULL DEFAULT 'brl',
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"          UUID,
  "deleted_at"          TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "stripe_payments" (
  "id"                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "config_id"                UUID NOT NULL REFERENCES "stripe_configs"("id"),
  "campo_id"                 UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "church_id"                UUID REFERENCES "churches"("id"),
  "user_id"                  UUID,
  "member_id"                UUID,
  "order_id"                 UUID,
  "stripe_payment_intent_id" VARCHAR(100),
  "stripe_session_id"        VARCHAR(100),
  "stripe_customer_id"       VARCHAR(100),
  "stripe_charge_id"         VARCHAR(100),
  "valor"                    DECIMAL(10,2) NOT NULL,
  "valor_refunded"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "moeda"                    VARCHAR(3) NOT NULL DEFAULT 'brl',
  "metodo"                   VARCHAR(30) NOT NULL,
  "tipo"                     VARCHAR(30) NOT NULL,
  "status"                   VARCHAR(30) NOT NULL DEFAULT 'pendente',
  "descricao"                VARCHAR(500),
  "pix_qr_code"              TEXT,
  "pix_expira"               TIMESTAMP(3),
  "receipt_url"              VARCHAR(500),
  "metadata"                 JSONB,
  "paid_at"                  TIMESTAMP(3),
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stripe_payments_campo_id_idx"                ON "stripe_payments"("campo_id");
CREATE INDEX IF NOT EXISTS "stripe_payments_church_id_idx"               ON "stripe_payments"("church_id");
CREATE INDEX IF NOT EXISTS "stripe_payments_user_id_idx"                 ON "stripe_payments"("user_id");
CREATE INDEX IF NOT EXISTS "stripe_payments_stripe_payment_intent_id_idx" ON "stripe_payments"("stripe_payment_intent_id");
CREATE INDEX IF NOT EXISTS "stripe_payments_stripe_session_id_idx"       ON "stripe_payments"("stripe_session_id");

CREATE TABLE IF NOT EXISTS "stripe_subscriptions" (
  "id"                     UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "config_id"              UUID NOT NULL REFERENCES "stripe_configs"("id"),
  "campo_id"               UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "church_id"              UUID REFERENCES "churches"("id"),
  "user_id"                UUID,
  "member_id"              UUID,
  "stripe_subscription_id" VARCHAR(100) NOT NULL UNIQUE,
  "stripe_customer_id"     VARCHAR(100),
  "stripe_price_id"        VARCHAR(100),
  "stripe_product_id"      VARCHAR(100),
  "tipo"                   VARCHAR(30),
  "valor"                  DECIMAL(10,2),
  "moeda"                  VARCHAR(3) NOT NULL DEFAULT 'brl',
  "frequencia"             VARCHAR(20),
  "status"                 VARCHAR(20) NOT NULL DEFAULT 'ativa',
  "proxima_cobranca"       TIMESTAMP(3),
  "cancelada_em"           TIMESTAMP(3),
  "pausada_em"             TIMESTAMP(3),
  "descricao"              VARCHAR(255),
  "metadata"               JSONB,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_campo_id_idx"            ON "stripe_subscriptions"("campo_id");
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_user_id_idx"             ON "stripe_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "stripe_subscriptions_stripe_subscription_id_idx" ON "stripe_subscriptions"("stripe_subscription_id");

CREATE TABLE IF NOT EXISTS "stripe_refunds" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "payment_id"       UUID NOT NULL REFERENCES "stripe_payments"("id") ON DELETE CASCADE,
  "stripe_refund_id" VARCHAR(100),
  "valor"            DECIMAL(10,2) NOT NULL,
  "moeda"            VARCHAR(3) NOT NULL DEFAULT 'brl',
  "motivo"           TEXT,
  "status"           VARCHAR(20) NOT NULL DEFAULT 'solicitado',
  "stripe_status"    VARCHAR(20),
  "solicitado_por"   UUID,
  "aprovado_por"     UUID,
  "motivo_rejeicao"  TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stripe_refunds_payment_id_idx" ON "stripe_refunds"("payment_id");

CREATE TABLE IF NOT EXISTS "stripe_webhook_logs" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"         UUID,
  "payment_id"       UUID REFERENCES "stripe_payments"("id"),
  "stripe_event_id"  VARCHAR(100) NOT NULL UNIQUE,
  "event_type"       VARCHAR(100) NOT NULL,
  "payload"          JSONB NOT NULL,
  "processado"       BOOLEAN NOT NULL DEFAULT false,
  "erro"             TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stripe_webhook_logs_campo_id_idx"       ON "stripe_webhook_logs"("campo_id");
CREATE INDEX IF NOT EXISTS "stripe_webhook_logs_stripe_event_id_idx" ON "stripe_webhook_logs"("stripe_event_id");
