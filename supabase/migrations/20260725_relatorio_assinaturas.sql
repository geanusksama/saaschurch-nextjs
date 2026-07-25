-- ---------------------------------------------------------------------------
-- Assinaturas do relatorio de tesouraria (Livro Caixa).
--
-- Uma assinatura por (igreja + periodo + slot). Os slots sao:
--   dirigente | tesCongreg | tesSede
--
-- Regra de remocao (aplicada nas rotas de API):
--   - assinar dirigente/tesCongreg: qualquer usuario autenticado
--   - assinar tesSede: somente nivel campo (campo/admin/master)
--   - remover qualquer assinatura: somente nivel campo (campo/admin/master)
--
-- Aditivo: nao altera nenhuma tabela existente.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidade_relatorio_assinaturas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id        UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  periodo_inicio   DATE NOT NULL,
  periodo_fim      DATE NOT NULL,
  slot             VARCHAR(20) NOT NULL CHECK (slot IN ('dirigente', 'tesCongreg', 'tesSede')),

  imagem           TEXT NOT NULL,               -- PNG dataURL (fundo transparente)
  assinado_por     VARCHAR(255),                -- nome de quem assinou
  assinado_por_id  VARCHAR(255),                -- id/sub do usuario
  profile_type     VARCHAR(20),                 -- perfil de quem assinou

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (church_id, periodo_inicio, periodo_fim, slot)
);

CREATE INDEX IF NOT EXISTS contabilidade_relatorio_assinaturas_lookup_idx
  ON contabilidade_relatorio_assinaturas (church_id, periodo_inicio, periodo_fim);

-- RLS ligado sem policy: acesso somente via service role nas rotas de API.
ALTER TABLE contabilidade_relatorio_assinaturas ENABLE ROW LEVEL SECURITY;
