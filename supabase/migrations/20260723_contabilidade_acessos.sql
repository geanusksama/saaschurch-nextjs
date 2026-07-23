-- ---------------------------------------------------------------------------
-- Contabilidade — acesso externo ao relatorio contabil (CSV do livro_caixa)
--
-- O contador nao tem usuario no sistema. Ele acessa por telefone + hash
-- (usuario/senha), recebe um codigo de 6 digitos no WhatsApp e so entao
-- consegue filtrar o periodo e gerar o CSV.
--
-- 3 tentativas erradas => ativo = false (bloqueio definitivo, so o master
-- reativa manualmente).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidade_acessos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nome           VARCHAR(255) NOT NULL,
  campo          VARCHAR(100) NOT NULL,          -- casa com livro_caixa.campo
  telefone       VARCHAR(20)  NOT NULL,          -- somente digitos, com DDD
  hash           VARCHAR(100) NOT NULL,          -- "senha" entregue ao contador
  ativo          BOOLEAN      NOT NULL DEFAULT TRUE,

  -- controle de tentativas (login e codigo)
  tentativas     INTEGER      NOT NULL DEFAULT 0,
  bloqueado_em   TIMESTAMPTZ,
  ultimo_acesso  TIMESTAMPTZ,

  -- trava de geracao: impede duas buscas simultaneas do mesmo acesso
  gerando        BOOLEAN      NOT NULL DEFAULT FALSE,
  gerando_desde  TIMESTAMPTZ,

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS contabilidade_acessos_telefone_key
  ON contabilidade_acessos (telefone);

CREATE INDEX IF NOT EXISTS contabilidade_acessos_campo_idx
  ON contabilidade_acessos (campo);

-- RLS ligado sem policy: ninguem acessa via anon/authenticated.
-- Todo o acesso passa pelas rotas de API usando a service role key.
ALTER TABLE contabilidade_acessos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Seed inicial — acesso de teste (campo campinas)
-- ---------------------------------------------------------------------------
INSERT INTO contabilidade_acessos (nome, campo, telefone, hash, ativo)
VALUES ('Contabilidade Campinas', 'campinas', '19992126683', '73LRS-4EXW7', TRUE)
ON CONFLICT (telefone) DO UPDATE
  SET hash       = EXCLUDED.hash,
      campo      = EXCLUDED.campo,
      nome       = EXCLUDED.nome,
      ativo      = TRUE,
      tentativas = 0,
      bloqueado_em = NULL,
      gerando    = FALSE,
      updated_at = NOW();
