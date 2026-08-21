-- Devolve ao Livro Caixa os lançamentos que a importação do sistema legado
-- marcou como excluídos sem que ninguém os tivesse excluído.
--
-- O QUE ACONTECEU
-- A carga do legado gravou `deleted_at` (e `situacao = false`) em TODAS as
-- linhas que inseriu: 321.347 de 321.382 linhas com `legacy_id`. Não é
-- exclusão de usuário, é carimbo de lote:
--   - bloco de 09/05/2026 00:31–02:39 → 320.560 linhas em 227 valores
--     distintos de deleted_at, em blocos de exatamente 1.600 linhas (o tamanho
--     do chunk do importador);
--   - bloco de 15/05/2026 03:25:41   → 787 linhas, TODAS com o mesmíssimo
--     timestamp: a carga delta do que foi lançado no legado entre as duas
--     rodadas.
-- Exclusão de verdade nunca produz esse padrão — ela tem timestamp próprio por
-- ação.
--
-- COMO SEPARAR O QUE FOI EXCLUSÃO DE VERDADE
-- `deletado_por`. Todo caminho de exclusão preenche esse campo — o estorno do
-- Contas a Pagar grava o nome do usuário (src/lib/contasPagarService.ts), e as
-- 35 exclusões que já vinham do legado chegaram com ele preenchido (o
-- importador jogou ali o deleted_at original, em texto ISO). São lançamentos de
-- teste, de R$ 0,01 a R$ 1,60, com favorecido "Teste", "fulano", "nmbro".
-- Essas 35, mais as 5 excluídas dentro do sistema novo em 15/08/2026 (por
-- "ADM System"), continuam excluídas. Só volta o que tem deletado_por NULL.
--
-- POR QUE APARECEU AGORA
-- Até 15/08/2026 a tela do Livro Caixa não filtrava `deleted_at` — as linhas
-- carimbadas apareciam assim mesmo e ninguém notou. O commit 85b40eb
-- acrescentou `.is('deleted_at', null)` à consulta, correto para não somar
-- estorno nos cards, e nesse instante todo o histórico anterior a maio sumiu da
-- tela. Janeiro/2026 ficou com 16 lançamentos visíveis de 3.443.
--
-- A tabela de backup guarda o estado anterior de cada linha tocada, para que
-- esta operação seja reversível.
CREATE TABLE IF NOT EXISTS "livro_caixa_baixa_importacao_backup" (
  "id"            UUID PRIMARY KEY,
  "deleted_at"    TIMESTAMP,
  "situacao"      BOOLEAN,
  "registrado_em" TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO "livro_caixa_baixa_importacao_backup" ("id", "deleted_at", "situacao")
SELECT "id", "deleted_at", "situacao"
FROM "livro_caixa"
WHERE "legacy_id"    IS NOT NULL
  AND "deleted_at"   IS NOT NULL
  AND "deletado_por" IS NULL
  AND "deleted_at"   < TIMESTAMP '2026-05-16 00:00:00'
ON CONFLICT ("id") DO NOTHING;

UPDATE "livro_caixa"
SET "deleted_at" = NULL,
    "situacao"   = TRUE
WHERE "legacy_id"    IS NOT NULL
  AND "deleted_at"   IS NOT NULL
  AND "deletado_por" IS NULL
  AND "deleted_at"   < TIMESTAMP '2026-05-16 00:00:00';
