-- EBD Negociações de Dívida

CREATE TABLE IF NOT EXISTS "ebd_negociacoes" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "campo_id"        UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
  "church_id"       UUID NOT NULL REFERENCES "churches"("id"),
  "titulo"          VARCHAR(255) NOT NULL,
  "descricao"       TEXT,
  "valor_total"     DECIMAL(10,2) NOT NULL,
  "num_parcelas"    INTEGER NOT NULL DEFAULT 1,
  "data_inicio"     DATE NOT NULL,
  "data_vencimento" DATE,
  "status"          VARCHAR(20) NOT NULL DEFAULT 'aberta',
  "observacao"      TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"      UUID,
  "deleted_at"      TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ebd_negociacoes_campo_id_idx"  ON "ebd_negociacoes"("campo_id");
CREATE INDEX IF NOT EXISTS "ebd_negociacoes_church_id_idx" ON "ebd_negociacoes"("church_id");

CREATE TABLE IF NOT EXISTS "ebd_negociacao_parcelas" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "negociacao_id"   UUID NOT NULL REFERENCES "ebd_negociacoes"("id") ON DELETE CASCADE,
  "num_parcela"     INTEGER NOT NULL,
  "valor"           DECIMAL(10,2) NOT NULL,
  "data_vencimento" DATE NOT NULL,
  "data_pagamento"  DATE,
  "status"          VARCHAR(20) NOT NULL DEFAULT 'pendente',
  "observacao"      TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ebd_negociacao_parcelas_negociacao_id_idx" ON "ebd_negociacao_parcelas"("negociacao_id");
