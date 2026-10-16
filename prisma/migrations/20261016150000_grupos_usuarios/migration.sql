-- Grupos de usuarios (2026-10-16). Ver docs/modules/permissoes-granulares/SPEC.md.
--
-- Grupo e coisa NOVA: as funcoes atuais (roles: tesoureiro, secretario...)
-- continuam categorias e nao sao tocadas. Nenhum usuario entra em grupo por
-- esta migration, entao ninguem muda de acesso no deploy (D5).
--
-- 1. grupos_usuarios: o grupo, por campo, com as regras em `permissions`
--    (mesmo formato de roles.permissions: {"members.view": true, ...}).
-- 2. grupos_usuarios_users: usuario <-> grupo, N:N. Estar em grupo faz a
--    regra do grupo valer no lugar da categoria e da sobrescrita pessoal (D2).
-- 3. grupos_usuarios_igrejas: igrejas que o grupo acessa. Criada agora, aplicada
--    na fase 3.
--
-- RLS ligada e sem politica: so a API (Prisma, que conecta como postgres) le e
-- grava, como user_campos. Idempotente.

create table if not exists public.grupos_usuarios (
  id          uuid primary key default gen_random_uuid(),
  campo_id    uuid not null references public.campos(id) on delete cascade,
  name        varchar(120) not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  created_by  uuid references public.users(id) on delete set null
);
create index if not exists grupos_usuarios_campo_id_idx on public.grupos_usuarios(campo_id);

create table if not exists public.grupos_usuarios_users (
  grupo_id   uuid not null references public.grupos_usuarios(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  primary key (grupo_id, user_id)
);
create index if not exists grupos_usuarios_users_user_id_idx on public.grupos_usuarios_users(user_id);

create table if not exists public.grupos_usuarios_igrejas (
  grupo_id   uuid not null references public.grupos_usuarios(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grupo_id, church_id)
);
create index if not exists grupos_usuarios_igrejas_church_id_idx on public.grupos_usuarios_igrejas(church_id);

alter table public.grupos_usuarios         enable row level security;
alter table public.grupos_usuarios_users   enable row level security;
alter table public.grupos_usuarios_igrejas enable row level security;
