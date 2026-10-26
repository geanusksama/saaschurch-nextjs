-- Engajamento — presença nas fotos da igreja e comparação entre períodos.
-- Ver docs/modules/engajamento/SPEC.md.
--
-- Migration ADITIVA: só CREATE TABLE / CREATE INDEX. Nenhuma tabela existente
-- é alterada. A Presença Facial (face_presencas) é só LIDA pela comparação.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. engajamento_instagram — a conta oficial da igreja conectada, por campo
--    O token de acesso (API do Instagram com login do Instagram) fica
--    criptografado (AES-256-GCM, src/lib/engajamento/cripto.ts).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.engajamento_instagram (
  id                   uuid primary key default gen_random_uuid(),
  campo_id             uuid not null,
  -- igreja onde as fotos da conta costumam ser tiradas (a sede): é a igreja
  -- que cada publicação nova recebe; a equipe corrige por publicação.
  church_id            uuid,
  ig_user_id           varchar(40),
  username             varchar(100),
  token_enc            text,
  token_expira_em      timestamptz,
  ultima_sincronizacao timestamptz,
  ultimo_erro          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,
  deleted_at           timestamptz
);
create unique index if not exists engajamento_instagram_campo_key
  on public.engajamento_instagram(campo_id) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. engajamento_publicacoes — uma publicação (ou um álbum de fotos) de um culto
--    ou evento. Vem do Instagram (sincronização) ou é lançada à mão.
--    data_evento é o dia do culto: nasce igual à data da publicação e a equipe
--    corrige quando a foto foi postada dias depois.
--    imagens: [{ "url": "<storage público>", "origem": "<url do Instagram>" }]
--    — a URL da CDN do Instagram expira, por isso a cópia no storage.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.engajamento_publicacoes (
  id           uuid primary key default gen_random_uuid(),
  campo_id     uuid not null,
  church_id    uuid,
  origem       varchar(20) not null default 'MANUAL',   -- INSTAGRAM | MANUAL
  ig_media_id  varchar(40),
  permalink    varchar(500),
  tipo         varchar(30),                             -- IMAGE | CAROUSEL_ALBUM | VIDEO | MANUAL
  titulo       varchar(200),
  legenda      text,
  publicado_em timestamptz,
  data_evento  date not null,
  imagens      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  deleted_at   timestamptz
);
create unique index if not exists engajamento_publicacoes_ig_media_key
  on public.engajamento_publicacoes(campo_id, ig_media_id) where ig_media_id is not null;
create index if not exists engajamento_publicacoes_campo_data_idx
  on public.engajamento_publicacoes(campo_id, data_evento);
create index if not exists engajamento_publicacoes_church_idx
  on public.engajamento_publicacoes(church_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. engajamento_marcacoes — quem a equipe confirmou na foto
--    member_id NULL = pessoa sem cadastro (fica o nome e, se houver, o @).
--    Marcação é feita por pessoa autorizada; não há reconhecimento facial
--    automático (dado biométrico + convicção religiosa = dado sensível, LGPD
--    art. 11).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.engajamento_marcacoes (
  id             uuid primary key default gen_random_uuid(),
  publicacao_id  uuid not null references public.engajamento_publicacoes(id) on delete cascade,
  member_id      uuid references public.members(id) on delete set null,
  nome           varchar(255) not null,
  instagram      varchar(100),
  imagem_indice  integer not null default 0,
  observacao     text,
  created_at     timestamptz not null default now(),
  created_by     uuid
);
create unique index if not exists engajamento_marcacoes_membro_key
  on public.engajamento_marcacoes(publicacao_id, member_id) where member_id is not null;
create index if not exists engajamento_marcacoes_member_idx
  on public.engajamento_marcacoes(member_id);

-- Leitura e escrita só pelo servidor (Prisma, papel do banco). O navegador
-- (chave anon) não enxerga nenhuma das três.
alter table public.engajamento_instagram   enable row level security;
alter table public.engajamento_publicacoes enable row level security;
alter table public.engajamento_marcacoes   enable row level security;
