-- =====================================================================
-- Tuning de indices — APLICADO EM PRODUCAO 2026-07-27
-- Base: extensions.pg_stat_statements + EXPLAIN (ANALYZE)
--
-- Nenhum dado foi apagado. A purga do livro caixa (<2023) foi avaliada
-- e descartada: com os indices abaixo o ganho adicional seria de ~0,1 ms,
-- contra a perda de 166.714 lancamentos / R$ 29.929.156,49 de escrituracao.
--
-- Se precisar reexecutar: NAO rode o arquivo inteiro de uma vez.
-- CREATE/DROP INDEX CONCURRENTLY nao roda dentro de transacao — uma
-- instrucao por vez, e por conexao direta (porta 5432, nunca o pooler).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Listagem do livro caixa ordenada por created_at
--    Antes: 3.774 chamadas, media 845 ms (~53 min de CPU acumulada)
--    Depois: 0,12 ms  — Index Scan, sem sort
--    Origem: src/app-ui/finance/LancamentoNew.tsx:1071 (loadRecentes)
-- ---------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS livro_caixa_church_id_created_at_idx
  ON public.livro_caixa (church_id, created_at DESC);

-- Mesma tela para perfil campo/regional/master (sem filtro de igreja)
CREATE INDEX CONCURRENTLY IF NOT EXISTS livro_caixa_created_at_idx
  ON public.livro_caixa (created_at DESC);


-- ---------------------------------------------------------------------
-- 2) Buscas ILIKE '%texto%' — nenhum B-tree serve para curinga a esquerda
--    favorecido:            1.662 ms -> 0,09 ms
--    members.full_name:       596 ms -> 0,08 ms
--    full_name+fantasy_name:  128 ms -> 0,09 ms
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX CONCURRENTLY IF NOT EXISTS livro_caixa_favorecido_trgm_idx
  ON public.livro_caixa USING gin (favorecido extensions.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS members_full_name_trgm_idx
  ON public.members USING gin (full_name extensions.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS members_fantasy_name_trgm_idx
  ON public.members USING gin (fantasy_name extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------
-- 3) Relatorio de contribuintes / tesouraria
--    Antes: 5.785 ms  |  Depois: 2,3 ms
-- ---------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS livro_caixa_relatorio_idx
  ON public.livro_caixa (church_id, plano_de_conta, tipo, data_lancamento);

CREATE INDEX CONCURRENTLY IF NOT EXISTS livro_caixa_data_lancamento_idx
  ON public.livro_caixa (data_lancamento DESC);


-- ---------------------------------------------------------------------
-- 4) Limpeza — indice 100% duplicado de livro_caixa_legacy_id_unique
--    17 MB, 0 scans. Libera espaco e alivia os INSERTs.
-- ---------------------------------------------------------------------
DROP INDEX CONCURRENTLY IF EXISTS public.livro_caixa_legacy_id_idx;


-- ---------------------------------------------------------------------
-- 5) Estatisticas
-- ---------------------------------------------------------------------
ANALYZE public.livro_caixa;
ANALYZE public.members;
ANALYZE public.kan_cards;
ANALYZE public.member_occurrences;
ANALYZE public.member_event_history;


-- =====================================================================
-- NAO APLICADO — avaliar antes (indices com idx_scan = 0)
-- Mantidos por precaucao: podem servir a relatorios sazonais que ainda
-- nao rodaram. Sao pequenos e o custo de manter e baixo.
-- =====================================================================
-- DROP INDEX CONCURRENTLY IF EXISTS public.livro_caixa_regional_idx;        -- 5 MB
-- DROP INDEX CONCURRENTLY IF EXISTS public.members_membership_status_idx;   -- 552 kB
-- DROP INDEX CONCURRENTLY IF EXISTS public.members_regional_id_idx;         -- 384 kB
-- DROP INDEX CONCURRENTLY IF EXISTS public.members_campo_id_idx;            -- 376 kB
-- DROP INDEX CONCURRENTLY IF EXISTS public.members_ecclesiastical_title_id_idx; -- 376 kB
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_kan_cards_dest_regional;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_kan_cards_origin_regional;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_kan_cards_requester_church;


-- =====================================================================
-- 6) REALTIME — aplicado em 2026-07-27
-- O modulo WhatsApp usa as instancias apenas para ENVIO, a partir da
-- tela de gestao pastoral. A caixa de entrada (communication/whatsapp-inbox)
-- nao e utilizada, entao os eventos ao vivo dessas tabelas eram descartados.
-- =====================================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_conversations;

-- Ainda publicadas (nao mexidas):
--   internal_chat_messages   -> em uso pelo ChatFAB
--   face_enrollment_signals  -> 110 escritas
--   feed_posts, feed_post_comments, feed_post_likes,
--   app_push_notifications   -> 0 escritas, ninguem assina (candidatas a limpeza)


-- ---------------------------------------------------------------------
-- 7) Verificacao (rodar 24h depois para confirmar adocao dos indices)
-- ---------------------------------------------------------------------
-- select indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
-- from pg_stat_user_indexes
-- where relname in ('livro_caixa','members') order by idx_scan desc;
--
-- select calls, round(mean_exec_time::numeric,1) mean_ms, left(query,80)
-- from extensions.pg_stat_statements
-- where query ilike '%livro_caixa%' order by total_exec_time desc limit 5;
