-- Migration: 001_create_santander_credentials
-- Módulo: Conciliação Bancária Santander
-- Data: 2026-06-10
-- Descrição: Credenciais seguras de acesso à API Santander por empresa/campo

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE santander_credentials (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                VARCHAR(50)   NOT NULL,
  campo                     VARCHAR(20)   NOT NULL,
  apelido                   VARCHAR(100)  NOT NULL,
  ambiente                  VARCHAR(10)   NOT NULL CHECK (ambiente IN ('sandbox', 'producao')),
  client_id                 VARCHAR(200)  NOT NULL,
  -- Client Secret nunca em claro: criptografado com AES-256
  client_secret_encrypted   TEXT          NOT NULL,
  client_secret_iv          VARCHAR(64)   NOT NULL,
  bank_id                   VARCHAR(14)   NOT NULL DEFAULT '90400888000142',
  certificate_public_path   TEXT          NOT NULL,
  -- Referência à chave privada — NUNCA armazenar o conteúdo da chave aqui
  certificate_private_ref   TEXT          NOT NULL,
  certificate_expires_at    TIMESTAMPTZ,
  tolerance_days            SMALLINT      NOT NULL DEFAULT 2 CHECK (tolerance_days BETWEEN 0 AND 7),
  ativo                     BOOLEAN       NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by                VARCHAR(100),
  updated_by                VARCHAR(100)
);

-- Uma credencial por empresa por ambiente
CREATE UNIQUE INDEX idx_santander_credentials_empresa_ambiente
  ON santander_credentials (empresa_id, ambiente);

CREATE INDEX idx_santander_credentials_campo
  ON santander_credentials (campo);

CREATE INDEX idx_santander_credentials_ativo
  ON santander_credentials (ativo);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_santander_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_santander_credentials_updated_at
  BEFORE UPDATE ON santander_credentials
  FOR EACH ROW EXECUTE FUNCTION update_santander_credentials_updated_at();

-- RLS: Segurança em nível de linha
ALTER TABLE santander_credentials ENABLE ROW LEVEL SECURITY;

-- Apenas service role (backend) pode ler/escrever
-- Frontend nunca acessa diretamente
CREATE POLICY "santander_credentials_service_only"
  ON santander_credentials
  USING (auth.role() = 'service_role');

COMMENT ON TABLE santander_credentials IS 'Credenciais de acesso à API Santander. Client Secret e chave privada protegidos. Auditado pelo Santander.';
COMMENT ON COLUMN santander_credentials.client_secret_encrypted IS 'Client Secret criptografado com AES-256-CBC. NUNCA retornar em APIs.';
COMMENT ON COLUMN santander_credentials.client_secret_iv IS 'IV (Initialization Vector) para descriptografia AES-256-CBC.';
COMMENT ON COLUMN santander_credentials.certificate_private_ref IS 'Referência ao arquivo da chave privada. NUNCA armazenar o conteúdo aqui.';
