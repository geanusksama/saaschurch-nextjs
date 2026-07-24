-- ---------------------------------------------------------------------------
-- Contabilidade — envio automatico agendado do relatorio via WhatsApp
--
-- Complementa contabilidade_acessos (20260723_contabilidade_acessos.sql).
-- Aditivo: nao altera nenhuma tabela existente.
--
-- contabilidade_agendamentos       -> config de envio por contador (1:1)
-- contabilidade_envios_historico   -> log de cada disparo (auto ou manual)
-- contabilidade_periodos_enviados  -> snapshot dos lancamentos de cada
--                                      periodo enviado, usado para comparar
--                                      versao atual x versao anterior
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidade_agendamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acesso_id      UUID NOT NULL UNIQUE REFERENCES contabilidade_acessos(id) ON DELETE CASCADE,

  ativo          BOOLEAN      NOT NULL DEFAULT FALSE,

  frequencia     VARCHAR(20)  NOT NULL DEFAULT 'mensal'
                 CHECK (frequencia IN ('mensal', 'semanal', 'manual')),
  dia_envio      SMALLINT     NOT NULL DEFAULT 1,   -- dia do mes (mensal) ou da semana (semanal, 0=domingo)
  hora_envio     TIME         NOT NULL DEFAULT '08:00',
  timezone       VARCHAR(50)  NOT NULL DEFAULT 'America/Sao_Paulo',

  tipo_periodo   VARCHAR(20)  NOT NULL DEFAULT 'mes_anterior'
                 CHECK (tipo_periodo IN ('mes_corrente', 'mes_anterior', 'gap')),
  gap_meses      SMALLINT     NOT NULL DEFAULT 1,
  qtd_meses      SMALLINT     NOT NULL DEFAULT 1,

  proximo_envio  TIMESTAMPTZ,
  ultimo_envio   TIMESTAMPTZ,

  created_by     VARCHAR(255),
  updated_by     VARCHAR(255),

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contabilidade_agendamentos_proximo_envio_idx
  ON contabilidade_agendamentos (proximo_envio)
  WHERE ativo = TRUE;

ALTER TABLE contabilidade_agendamentos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidade_envios_historico (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id         UUID REFERENCES contabilidade_agendamentos(id) ON DELETE SET NULL,
  acesso_id              UUID NOT NULL REFERENCES contabilidade_acessos(id) ON DELETE CASCADE,

  disparado_em           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  tipo                   VARCHAR(20)  NOT NULL CHECK (tipo IN ('automatico', 'manual')),

  gap_meses              SMALLINT,
  qtd_meses              SMALLINT,
  periodos               JSONB        NOT NULL DEFAULT '[]'::jsonb, -- [{ano,mes,qtd_registros,qtd_divergencias,versao}]

  status                 VARCHAR(20)  NOT NULL DEFAULT 'sucesso'
                         CHECK (status IN ('sucesso', 'erro', 'parcial')),
  tempo_processamento_ms INTEGER,
  total_registros        INTEGER      NOT NULL DEFAULT 0,
  total_divergencias     INTEGER      NOT NULL DEFAULT 0,
  erro                   TEXT,
  whatsapp_message_id    TEXT,

  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contabilidade_envios_historico_acesso_idx
  ON contabilidade_envios_historico (acesso_id, disparado_em DESC);

ALTER TABLE contabilidade_envios_historico ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidade_periodos_enviados (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acesso_id      UUID NOT NULL REFERENCES contabilidade_acessos(id) ON DELETE CASCADE,
  historico_id   UUID REFERENCES contabilidade_envios_historico(id) ON DELETE SET NULL,

  ano            SMALLINT     NOT NULL,
  mes            SMALLINT     NOT NULL CHECK (mes BETWEEN 1 AND 12),
  versao         INTEGER      NOT NULL DEFAULT 1,

  lancamento_ids JSONB        NOT NULL DEFAULT '[]'::jsonb, -- uuids do livro_caixa incluidos nesta versao
  qtd_registros  INTEGER      NOT NULL DEFAULT 0,

  enviado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (acesso_id, ano, mes, versao)
);

CREATE INDEX IF NOT EXISTS contabilidade_periodos_enviados_lookup_idx
  ON contabilidade_periodos_enviados (acesso_id, ano, mes, versao DESC);

ALTER TABLE contabilidade_periodos_enviados ENABLE ROW LEVEL SECURITY;

-- RLS ligado sem policy em todas as 3: mesmo padrao de contabilidade_acessos —
-- ninguem acessa via anon/authenticated, tudo passa pela service role key nas rotas de API.
