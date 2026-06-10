-- Migration: 002_create_santander_accounts
-- Módulo: Conciliação Bancária Santander
-- Data: 2026-06-10
-- Descrição: Contas bancárias Santander vinculadas às igrejas

CREATE TABLE santander_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id    UUID          NOT NULL REFERENCES santander_credentials(id) ON DELETE CASCADE,
  account_id       VARCHAR(100)  NOT NULL,
  bank_id          VARCHAR(14)   NOT NULL DEFAULT '90400888000142',
  compe_code       VARCHAR(3),
  branch_code      VARCHAR(5)    NOT NULL,
  account_number   VARCHAR(12)   NOT NULL,
  account_digit    VARCHAR(1),
  display_name     VARCHAR(100)  NOT NULL,
  -- FK opcional para church — permite vincular conta a uma igreja
  -- Referencia a coluna id de churches (INTEGER) do sistema existente
  igreja_id        INTEGER,
  ativa            BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Uma conta por credencial (agência + conta)
CREATE UNIQUE INDEX idx_santander_accounts_unique
  ON santander_accounts (credential_id, branch_code, account_number);

CREATE INDEX idx_santander_accounts_credential
  ON santander_accounts (credential_id);

CREATE INDEX idx_santander_accounts_igreja
  ON santander_accounts (igreja_id);

CREATE INDEX idx_santander_accounts_ativa
  ON santander_accounts (ativa);

-- Campo computado virtual (não armazenado): statement_id para a API Santander
-- Formato: LPAD(branch_code, 4, '0') || '.' || LPAD(account_number, 12, '0')
-- Ex: '0001.000010331607'
-- Gerado em código TypeScript no service

CREATE OR REPLACE FUNCTION update_santander_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_santander_accounts_updated_at
  BEFORE UPDATE ON santander_accounts
  FOR EACH ROW EXECUTE FUNCTION update_santander_accounts_updated_at();

ALTER TABLE santander_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "santander_accounts_service_only"
  ON santander_accounts
  USING (auth.role() = 'service_role');

COMMENT ON TABLE santander_accounts IS 'Contas bancárias Santander sincronizadas da API. Vinculadas opcionalmente às igrejas do sistema.';
COMMENT ON COLUMN santander_accounts.account_id IS 'accountId retornado pela API Santander (pode variar de formato entre contas).';
COMMENT ON COLUMN santander_accounts.igreja_id IS 'FK opcional para church. Quando NULL, conta não está vinculada a uma igreja específica.';
