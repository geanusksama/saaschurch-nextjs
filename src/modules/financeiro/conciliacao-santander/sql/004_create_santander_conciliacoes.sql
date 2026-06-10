-- Migration: 004_create_santander_conciliacoes
-- Módulo: Conciliação Bancária Santander
-- Data: 2026-06-10
-- Descrição: Registro de conciliações entre movimentos Santander e Livro Caixa

CREATE TYPE santander_conciliacao_tipo AS ENUM (
  'automatico',
  'manual',
  'sugerido'
);

CREATE TYPE santander_conciliacao_status AS ENUM (
  'ativo',
  'desfeito'
);

CREATE TABLE santander_conciliacoes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santander_movimento_id   UUID          NOT NULL REFERENCES santander_movimentos(id),
  livro_caixa_id           INTEGER       NOT NULL,
  tipo_match               santander_conciliacao_tipo   NOT NULL,
  score_match              SMALLINT      CHECK (score_match BETWEEN 0 AND 100),
  status                   santander_conciliacao_status NOT NULL DEFAULT 'ativo',
  observacao               TEXT,
  conciliado_por           VARCHAR(100)  NOT NULL,
  conciliado_em            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Apenas uma conciliação ativa por movimento
CREATE UNIQUE INDEX idx_santander_conciliacoes_unique_ativo
  ON santander_conciliacoes (santander_movimento_id)
  WHERE status = 'ativo';

CREATE INDEX idx_santander_conciliacoes_movimento
  ON santander_conciliacoes (santander_movimento_id);

CREATE INDEX idx_santander_conciliacoes_livro_caixa
  ON santander_conciliacoes (livro_caixa_id);

CREATE INDEX idx_santander_conciliacoes_status
  ON santander_conciliacoes (status);

ALTER TABLE santander_conciliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "santander_conciliacoes_service_only"
  ON santander_conciliacoes
  USING (auth.role() = 'service_role');

COMMENT ON TABLE santander_conciliacoes IS 'Registro de conciliações entre movimentos Santander e lançamentos do Livro Caixa. Auditável.';
COMMENT ON COLUMN santander_conciliacoes.score_match IS 'Score de match automático 0-100. >=90 = exato, 60-89 = sugerido, <60 = improvável.';
