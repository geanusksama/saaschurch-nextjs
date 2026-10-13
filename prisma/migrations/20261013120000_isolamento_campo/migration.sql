-- Isolamento por campo (2026-10-13)
--
-- 1. user_campos: campos que o usuario pode navegar pelo seletor "Alternar
--    Campo", definidos pelo master na tela do usuario. Uma linha por campo,
--    com a lotacao (igreja/regional) assumida ao entrar nele.
-- 2. RLS por campo nas tabelas que as telas leem DIRETO do navegador
--    (supabase-js): regionais, churches, members, livro_caixa. Antes a politica
--    era so fn_usuario_sistema() — qualquer usuario logado lia todos os campos.
--    O campo e o users.campo_id (o campo ativo, que a troca de campo grava).
-- 3. users e roles passam a ser so leitura para o papel authenticated. A
--    politica antiga deixava qualquer usuario logado gravar profile_type ou
--    campo_id no proprio cadastro pela API REST, o que anula o isolamento.
--    Toda gravacao em users/roles ja passa pelas rotas /api (Prisma, que
--    conecta como postgres e nao passa por RLS).
--
-- Idempotente. O Prisma e o supabaseAdmin (service_role) nao sao afetados.

-- -----------------------------------------------------------------------------
-- 1. user_campos
-- -----------------------------------------------------------------------------
create table if not exists public.user_campos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  campo_id    uuid not null references public.campos(id) on delete cascade,
  church_id   uuid references public.churches(id) on delete set null,
  regional_id uuid references public.regionais(id) on delete set null,
  created_at  timestamp(3) not null default current_timestamp,
  updated_at  timestamp(3) not null default current_timestamp
);
create unique index if not exists user_campos_user_id_campo_id_key on public.user_campos(user_id, campo_id);
create index if not exists user_campos_campo_id_idx on public.user_campos(campo_id);

-- Sem politica de proposito: ninguem le nem grava pelo navegador. Quem pode
-- navegar em qual campo e decisao do master, e so passa pela API.
alter table public.user_campos enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Campo ativo do usuario logado
-- -----------------------------------------------------------------------------
-- Mesmo criterio de src/lib/auth.ts: users.campo_id, ou o campo da regional,
-- ou o campo da regional da igreja.
create or replace function public.fn_meu_campo_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(u.campo_id, r.campo_id, rc.campo_id)
    from public.users u
    left join public.regionais r on r.id = u.regional_id
    left join public.churches c on c.id = u.church_id
    left join public.regionais rc on rc.id = c.regional_id
   where u.deleted_at is null
     and u.profile_type in ('master', 'admin', 'campo', 'church')
     and lower(u.email) = lower(nullif(auth.jwt() ->> 'email', ''))
   limit 1
$function$;

create or replace function public.fn_igrejas_do_meu_campo()
returns uuid[]
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(array_agg(c.id), '{}'::uuid[])
    from public.churches c
    join public.regionais r on r.id = c.regional_id
   where r.campo_id = public.fn_meu_campo_id()
$function$;

-- -----------------------------------------------------------------------------
-- 3. Politicas por campo
-- -----------------------------------------------------------------------------
drop policy if exists "sistema_acesso" on public.regionais;
create policy "sistema_acesso" on public.regionais as permissive for all to authenticated
  using ((select fn_usuario_sistema()) and campo_id = (select fn_meu_campo_id()))
  with check ((select fn_usuario_sistema()) and campo_id = (select fn_meu_campo_id()));

drop policy if exists "sistema_acesso" on public.churches;
create policy "sistema_acesso" on public.churches as permissive for all to authenticated
  using ((select fn_usuario_sistema()) and id = any(((select fn_igrejas_do_meu_campo())::uuid[])))
  with check ((select fn_usuario_sistema()) and id = any(((select fn_igrejas_do_meu_campo())::uuid[])));

drop policy if exists "sistema_acesso" on public.members;
create policy "sistema_acesso" on public.members as permissive for all to authenticated
  using ((select fn_usuario_sistema()) and church_id = any(((select fn_igrejas_do_meu_campo())::uuid[])))
  with check ((select fn_usuario_sistema()) and church_id = any(((select fn_igrejas_do_meu_campo())::uuid[])));

drop policy if exists "sistema_acesso" on public.livro_caixa;
create policy "sistema_acesso" on public.livro_caixa as permissive for all to authenticated
  using ((select fn_usuario_sistema()) and church_id = any(((select fn_igrejas_do_meu_campo())::uuid[])))
  with check ((select fn_usuario_sistema()) and church_id = any(((select fn_igrejas_do_meu_campo())::uuid[])));

-- users / roles: leitura so. users enxerga o proprio campo (e o proprio
-- cadastro, mesmo sem campo).
drop policy if exists "sistema_acesso" on public.users;
create policy "sistema_acesso" on public.users as permissive for select to authenticated
  using (
    (select fn_usuario_sistema())
    and (
      campo_id = (select fn_meu_campo_id())
      or lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "sistema_acesso" on public.roles;
create policy "sistema_acesso" on public.roles as permissive for select to authenticated
  using ((select fn_usuario_sistema()));
