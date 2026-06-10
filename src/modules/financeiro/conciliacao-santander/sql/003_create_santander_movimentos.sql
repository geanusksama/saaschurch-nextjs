-- Migration: 003_create_santander_movimentos
-- Módulo: Conciliação Bancária Santander
-- Data: 2026-06-10
-- Descrição: Movimentos bancários importados da API Santander ou FEBRABAN 240

CREATE TYPE santander_movimento_status AS ENUM (
  'novo',
  'match_exato',
  'match_sugerido',
  'sem_lancamento',
  'sem_movimento_bancario',
  'conciliado',
  'ignorado',
  'lancado',
  'duplicado'
);

CREATE TYPE santander_movimento_source AS ENUM (
  'api',
  'febraban',
  'importacao'
);

CREATE TABLE santander_movimentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id         UUID          NOT NULL REFERENCES santander_credentials(id),
  santander_account_id  UUID          NOT NULL REFERENCES santander_accounts(id),
  account_id            VARCHAR(100)  NOT NULL,
  -- ID retornado pela API Santander (pode ser nulo para importações FEBRABAN)
  transaction_id        VARCHAR(200),
  transaction_date      DATE          NOT NULL,
  accounting_date       DATE,
  -- Valor sempre positivo; usar credit_debit_type para determinar sentido
  amount                DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  credit_debit_type     VARCHAR(1)    NOT NULL CHECK (credit_debit_type IN ('C', 'D')),
  transaction_name      VARCHAR(200),
  -- Categoria FEBRABAN: 101-127 débitos, 201-222 créditos
  category_code         VARCHAR(3),
  history_code          VARCHAR(4),
  history_description   VARCHAR(200),
  document_number       VARCHAR(50),
  complement            VARCHAR(200),
  -- Payload bruto da API para auditoria — sem tokens ou secrets
  raw_payload           JSONB,
  source                santander_movimento_source NOT NULL DEFAULT 'api',
  status                santander_movimento_status NOT NULL DEFAULT 'novo',
  -- Referência ao lançamento do Livro Caixa quando status = 'lancado'
  livro_caixa_id        INTEGER,
  -- SHA-256 de: account_id + transaction_date + amount + credit_debit_type + document_number + history_code
  hash_unico            VARCHAR(64)   NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  imported_by           VARCHAR(100)
);

-- Índice único por hash_unico — garante deduplicação mesmo sob concorrência
CREATE UNIQUE INDEX idx_santander_movimentos_hash
  ON santander_movimentos (hash_unico);

CREATE INDEX idx_santander_movimentos_account_date
  ON santander_movimentos (santander_account_id, transaction_date);

CREATE INDEX idx_santander_movimentos_status
  ON santander_movimentos (status);

CREATE INDEX idx_santander_movimentos_livro_caixa
  ON santander_movimentos (livro_caixa_id)
  WHERE livro_caixa_id IS NOT NULL;

CREATE INDEX idx_santander_movimentos_credential
  ON santander_movimentos (credential_id);

CREATE INDEX idx_santander_movimentos_source
  ON santander_movimentos (source);

-- Índice para buscas de conciliação: valor + tipo + data
CREATE INDEX idx_santander_movimentos_conciliacao
  ON santander_movimentos (amount, credit_debit_type, transaction_date);

CREATE OR REPLACE FUNCTION update_santander_movimentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_santander_movimentos_updated_at
  BEFORE UPDATE ON santander_movimentos
  FOR EACH ROW EXECUTE FUNCTION update_santander_movimentos_updated_at();

ALTER TABLE santander_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "santander_movimentos_service_only"
  ON santander_movimentos
  USING (auth.role() = 'service_role');

COMMENT ON TABLE santander_movimentos IS 'Movimentos bancários importados da API Santander ou FEBRABAN 240. Deduplicados por hash_unico.';
COMMENT ON COLUMN santander_movimentos.hash_unico IS 'SHA-256(account_id+transaction_date+amount+credit_debit_type+document_number+history_code). Garante deduplicação.';
COMMENT ON COLUMN santander_movimentos.raw_payload IS 'Payload bruto da API para auditoria. Validado para não conter tokens ou secrets antes de salvar.';
COMMENT ON COLUMN santander_movimentos.livro_caixa_id IS 'FK para o lançamento do Livro Caixa criado a partir deste movimento. Preenchido apenas quando status=lancado.';
