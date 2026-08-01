-- Cache das respostas da IA da Central de Ajuda.
--
-- A mesma dúvida é feita por muita gente ("como cadastro um membro?"). Sem
-- cache, cada uma dessas é uma chamada paga que devolve exatamente o mesmo
-- texto — a documentação não muda entre uma pergunta e outra.
--
-- A chave NÃO é só a pergunta: a documentação enviada à IA é recortada pelo
-- que cada pessoa pode ver, então a resposta de um admin não pode ser servida
-- para quem tem menos acesso. Por isso `scope_hash` (perfil + módulos
-- visíveis) entra na chave junto com a pergunta normalizada.
--
-- Tudo aditivo e com IF NOT EXISTS: pode rodar em produção com o sistema no ar.

CREATE TABLE IF NOT EXISTS help_ai_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- sha256 de (pergunta normalizada + scope_hash)
  cache_key    text NOT NULL UNIQUE,
  -- pergunta como a pessoa escreveu, para montar a lista de "mais perguntadas"
  question     text NOT NULL,
  -- pergunta sem acento/pontuação, usada no agrupamento
  question_norm text NOT NULL,
  scope_hash   text NOT NULL,
  answer       text NOT NULL,
  sources      jsonb NOT NULL DEFAULT '[]',
  hits         int  NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_ai_cache_key ON help_ai_cache (cache_key);
-- alimenta as sugestões: o que mais se pergunta, dentro do mesmo escopo
CREATE INDEX IF NOT EXISTS idx_help_ai_cache_populares
  ON help_ai_cache (scope_hash, hits DESC, last_used_at DESC);
