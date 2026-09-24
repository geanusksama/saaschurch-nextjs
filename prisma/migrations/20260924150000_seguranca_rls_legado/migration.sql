-- =============================================================================
-- Segurança das tabelas legadas do saaschurch (D-10 e D-16 de appv3/docs)
--
-- Situação medida no banco de referência em 2026-09-24:
--   * 155 das 312 tabelas de public sem RLS, com anon e authenticated podendo
--     ler e alterar tudo (members, users, livro_caixa, stripe_configs...);
--   * tabelas pastorais, de oração e de discipulado com política para
--     `public` do tipo `app.current_church_id() IS NULL OR ...` — pela API
--     essa função devolve NULL, então valem como abertas;
--   * tabelas do app antigo (novoChurch) liberadas para qualquer membro logado;
--   * view pastoral_timeline rodando com o direito do dono (ignora RLS);
--   * funções SECURITY DEFINER do app antigo executáveis por anon, inclusive
--     fn_apply_campo_policies/fn_setup_campo_scope (montam DDL) e
--     app_confirm_order/fn_aprovar_reembolso;
--   * buckets `dados` e `cultos` com leitura, escrita e exclusão para `public`.
--
-- Regra adotada: fora o app novo (tabelas appv3_*, que têm RLS própria) e o
-- que é público de propósito (sites de departamento, sede e horários), só
-- quem é usuário ativo do sistema acessa pela API. "Usuário do sistema" é
-- exatamente o que o saaschurch já considera (src/lib/auth.ts e AppUI.tsx):
-- linha em public.users com o mesmo e-mail da conta, não excluída e com
-- perfil master/admin/campo/church. O servidor do saaschurch (Prisma como
-- `postgres`, BYPASSRLS; supabaseAdmin com service_role) não passa por RLS.
--
-- O app antigo deixa de funcionar de propósito (decisão do dono, 2026-09-24).
-- Nenhuma tabela é apagada aqui.
--
-- Idempotente. Depois de aplicar: regerar o baseline e manter as partes que o
-- dump não carrega (grants de função, opção da view, DROP de política antiga)
-- em saaschurch-nextjs/baseline/98_patches.sql.
-- =============================================================================

-- 1. Quem é usuário do sistema ------------------------------------------------
create or replace function public.fn_usuario_sistema()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
     where u.deleted_at is null
       and u.profile_type in ('master', 'admin', 'campo', 'church')
       and lower(u.email) = lower(nullif(auth.jwt() ->> 'email', '')))
$$;
comment on function public.fn_usuario_sistema() is
  'Conta logada é usuário ativo do saaschurch (mesma regra de src/lib/auth.ts). Usada nas políticas sistema_acesso/sistema_somente.';

-- 2. Tabelas sem RLS: liga a RLS e libera só para usuário do sistema -----------
do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('drop policy if exists sistema_acesso on public.%I', t.relname);
    execute format('create policy sistema_acesso on public.%I as permissive for all to authenticated '
                   'using ((select public.fn_usuario_sistema())) with check ((select public.fn_usuario_sistema()))', t.relname);
  end loop;
end $$;

-- 3. Tabelas com RLS e política aberta a anon/authenticated/public: acrescenta
--    uma política RESTRITIVA. Ela soma (AND) às políticas que já existem, sem
--    trocá-las: o saaschurch continua com as mesmas regras de hoje e quem não
--    é usuário do sistema fica de fora.
do $$
declare t record;
begin
  for t in
    select distinct p.tablename
      from pg_policies p
     where p.schemaname = 'public'
       and p.permissive = 'PERMISSIVE'
       and p.policyname not in ('sistema_acesso')
       and p.roles && array['public', 'anon', 'authenticated']::name[]
       and p.tablename not like 'appv3\_%'
       -- públicas de propósito: sites de departamento, sede, horários, campos
       -- e o sinal que o agente faceRemoto escuta com a anon key
       and p.tablename <> all (array[
         'campos', 'headquarters', 'church_schedule', 'church_access_info',
         'department_sites', 'department_site_blocks', 'department_products',
         'department_product_images', 'department_product_variants',
         'department_event_forms', 'site_style_presets', 'ministries',
         'face_enrollment_signals'])
  loop
    execute format('drop policy if exists sistema_somente on public.%I', t.tablename);
    execute format('create policy sistema_somente on public.%I as restrictive for all to anon, authenticated '
                   'using ((select public.fn_usuario_sistema())) with check ((select public.fn_usuario_sistema()))', t.tablename);
  end loop;
end $$;

-- 4. View que ignorava a RLS das tabelas pastorais ---------------------------
-- Ela roda com o direito do dono. `security_invoker` não serve: as políticas
-- de prayer_requests chamam o schema `app`, que authenticated não enxerga, e
-- a view passaria a dar erro no saaschurch (hoje ela responde). Mantém-se a
-- view e acrescenta-se o mesmo filtro das tabelas: resultado idêntico para o
-- usuário do sistema, vazio para o resto. A definição nova sai no baseline.
do $$
declare d text := pg_get_viewdef('public.pastoral_timeline'::regclass);
begin
  if position('fn_usuario_sistema' in d) = 0 then
    execute 'create or replace view public.pastoral_timeline as select * from ('
            || rtrim(d, E'; \n') || ') t where (select public.fn_usuario_sistema())';
  end if;
end $$;
revoke all on public.pastoral_timeline from anon;

-- 5. Funções do app antigo -----------------------------------------------------
-- Sem uso no saaschurch pela API (o servidor chama fn_aprovar/negar_reembolso
-- pelo Prisma, como dono). Ninguém de fora executa mais.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'app_cancel_order', 'app_cleanup_expired_cart', 'app_confirm_order',
       'app_generate_seats_for_hall', 'app_reserve_seat', 'fn_apply_campo_policies',
       'fn_setup_campo_scope', 'fn_aprovar_reembolso', 'fn_negar_reembolso',
       'fn_publish_department_site', 'fn_register_app_user', 'get_my_crm_profile',
       'fn_add_free_tickets', 'fn_cancel_ticket', 'fn_delete_department',
       'fn_reserve_seat', 'fn_transfer_dept_events', 'fn_transfer_ticket')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- usadas dentro de políticas avaliadas para authenticated: tira só o anon
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('fn_campo_visible', 'fn_get_my_campo_id', 'fn_is_campo_admin', 'fn_is_master')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- 6. Storage ---------------------------------------------------------------------
-- Os buckets continuam públicos: a URL pública das fotos segue funcionando sem
-- política. O que fecha é listar, gravar, trocar e apagar pela API.
drop policy if exists "livre 1krhyj_0" on storage.objects;
drop policy if exists "livre 1krhyj_1" on storage.objects;
drop policy if exists "livre 1krhyj_2" on storage.objects;
drop policy if exists "livre 1krhyj_3" on storage.objects;
drop policy if exists "liuvres2 1cprxsu_0" on storage.objects;
drop policy if exists "liuvres2 1cprxsu_1" on storage.objects;
drop policy if exists "liuvres2 1cprxsu_2" on storage.objects;

drop policy if exists dados_sistema on storage.objects;
create policy dados_sistema on storage.objects for all to authenticated
  using (bucket_id in ('dados', 'cultos') and (select public.fn_usuario_sistema()))
  with check (bucket_id in ('dados', 'cultos') and (select public.fn_usuario_sistema()));

-- App v3, cadastro facial (H1): o membro vinculado envia a foto só para a
-- própria pasta, faceid/enroll/<member_id>/, como a função appv3_faceid_cadastrar exige.
drop policy if exists dados_faceid_app on storage.objects;
create policy dados_faceid_app on storage.objects for insert to authenticated
  with check (bucket_id = 'dados'
              and name like 'faceid/enroll/' || (select p.member_id::text from public.appv3_perfis p
                                                  where p.auth_user_id = auth.uid()) || '/%');
