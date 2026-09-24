-- App Igreja v3: Bíblia — versículos salvos e anotações de culto.
-- ADITIVA e idempotente. Fonte: appv3/app/supabase/appv3_schema.sql.

-- Bíblia: versículos salvos e anotações de culto (H16), da pessoa.
create table if not exists public.appv3_biblia_salvos (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  livro      varchar(3) not null,
  capitulo   integer not null,
  versiculos integer[] not null,
  texto      text not null,
  anotacao   text,
  criado_em  timestamptz not null default now()
);
create index if not exists appv3_biblia_salvos_perfil_idx on public.appv3_biblia_salvos(perfil_id, criado_em);

create table if not exists public.appv3_biblia_anotacoes (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  titulo        varchar(120) not null,
  dia_semana    smallint not null check (dia_semana between 0 and 6),
  segmentos     jsonb not null default '[]'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists appv3_biblia_anotacoes_perfil_idx on public.appv3_biblia_anotacoes(perfil_id, atualizado_em);

alter table public.appv3_biblia_salvos enable row level security;
alter table public.appv3_biblia_anotacoes enable row level security;
revoke all on table public.appv3_biblia_salvos, public.appv3_biblia_anotacoes from anon, authenticated;
grant all on table public.appv3_biblia_salvos, public.appv3_biblia_anotacoes to service_role;
grant select, insert, update, delete on public.appv3_biblia_salvos, public.appv3_biblia_anotacoes to authenticated;
drop policy if exists appv3_biblia_salvos_dono on public.appv3_biblia_salvos;
create policy appv3_biblia_salvos_dono on public.appv3_biblia_salvos for all to authenticated
  using (perfil_id = public.appv3_meu_perfil_id()) with check (perfil_id = public.appv3_meu_perfil_id());
drop policy if exists appv3_biblia_anotacoes_dono on public.appv3_biblia_anotacoes;
create policy appv3_biblia_anotacoes_dono on public.appv3_biblia_anotacoes for all to authenticated
  using (perfil_id = public.appv3_meu_perfil_id()) with check (perfil_id = public.appv3_meu_perfil_id());
