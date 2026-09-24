-- Correções pontuais nos bancos das igrejas já provisionadas.
--
-- ESTE ARQUIVO É ESCRITO À MÃO. Ele não sai do `baseline:dump` e não é
-- sobrescrito por ele.
--
-- Por que existe: todo o resto do baseline só CRIA. `create table if not
-- exists`, `add column if not exists`, `create index if not exists` — nenhum
-- deles remove nem altera objeto que já está lá. Isso é proposital, é o que
-- torna o baseline seguro de rodar repetidas vezes em produção. Mas deixa um
-- buraco: quando algo é REMOVIDO ou AFROUXADO no banco de referência, o dump
-- simplesmente para de mencionar aquilo, e a igreja que já tem o objeto antigo
-- fica com ele para sempre.
--
-- Foi o que aconteceu com o unique de `churches (regional_id, code)`: ele saiu
-- do baseline, mas continuava vivo em cada igreja, barrando o cadastro que o
-- código novo permite.
--
-- REGRAS PARA ESCREVER AQUI
--   1. Idempotente e tolerante: roda em todo deploy de toda igreja, muitas
--      vezes. Sempre `IF EXISTS` / `IF NOT EXISTS`.
--   2. Só o que o dump não consegue expressar: DROP e ALTER de objeto que já
--      existe. Coisa nova continua vindo do baseline gerado.
--   3. Nunca apague dado. Este arquivo mexe em ESTRUTURA.
--   4. Datar e explicar o porquê — quem lê daqui a um ano precisa saber se a
--      linha ainda faz sentido ou se já pode sair.

-- 2026-09-03 — o código da igreja passou a aceitar repetição.
-- O número é o que a secretaria usa e ele se repete de propósito (Sede 1,
-- Sede Brasil 1, Sede UEA 1), como o `rol` do membro. Quem identifica a linha
-- é o id. O índice comum que substitui o unique vem do baseline gerado.
DROP INDEX IF EXISTS "churches_regional_id_code_key";
DROP INDEX IF EXISTS "churches_regional_id_code_periodo_key";

-- 2026-09-24 — segurança das tabelas legadas (appv3/app/supabase/seguranca_legado.sql).
-- O dump carrega a RLS ligada, as políticas novas (sistema_acesso,
-- sistema_somente, dados_sistema, dados_faceid_app) e a view pastoral_timeline
-- com o filtro. Não carrega: grants de função (e o 12_grants dá EXECUTE de toda
-- função ao anon por default privileges), revoke em view e a remoção das
-- políticas antigas do storage. Por isso ficam aqui.

-- Funções do app antigo: ninguém de fora executa (o servidor chama pelo Prisma).
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              'app_cancel_order', 'app_cleanup_expired_cart', 'app_confirm_order',
              'app_generate_seats_for_hall', 'app_reserve_seat', 'fn_apply_campo_policies',
              'fn_setup_campo_scope', 'fn_aprovar_reembolso', 'fn_negar_reembolso',
              'fn_publish_department_site', 'fn_register_app_user', 'get_my_crm_profile',
              'fn_add_free_tickets', 'fn_cancel_ticket', 'fn_delete_department',
              'fn_reserve_seat', 'fn_transfer_dept_events', 'fn_transfer_ticket')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('fn_campo_visible', 'fn_get_my_campo_id', 'fn_is_campo_admin', 'fn_is_master')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Funções do app v3: mesmos grants de appv3_schema.sql §11, que o dump não leva.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('appv3_localizar_membro', 'appv3_freio_vinculo', 'appv3_linha_diretorio')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', f);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname LIKE 'appv3\_%' AND p.prokind = 'f'
              AND p.proname NOT IN ('appv3_localizar_membro', 'appv3_freio_vinculo', 'appv3_linha_diretorio',
                                    'appv3_estrutura_publica', 'appv3_mundial_publico',
                                    'appv3_digitos', 'appv3_status_membro', 'appv3_codigo',
                                    'appv3_meu_perfil_id', 'appv3_meu_campo_id', 'appv3_campo_da_igreja')
              AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

REVOKE ALL ON public.pastoral_timeline FROM anon;

-- Storage: políticas "livres" (public lia, gravava e apagava tudo em dados e cultos).
DROP POLICY IF EXISTS "livre 1krhyj_0" ON storage.objects;
DROP POLICY IF EXISTS "livre 1krhyj_1" ON storage.objects;
DROP POLICY IF EXISTS "livre 1krhyj_2" ON storage.objects;
DROP POLICY IF EXISTS "livre 1krhyj_3" ON storage.objects;
DROP POLICY IF EXISTS "liuvres2 1cprxsu_0" ON storage.objects;
DROP POLICY IF EXISTS "liuvres2 1cprxsu_1" ON storage.objects;
DROP POLICY IF EXISTS "liuvres2 1cprxsu_2" ON storage.objects;
