-- Engajamento — reconhecimento de rostos nas fotos do Instagram da igreja.
-- Ver docs/modules/engajamento/SPEC.md.
--
-- Decisão do dono em 26/10/2026: o sistema reconhece os rostos sozinho e a
-- equipe dá o nome de cada pessoa uma vez. O vetor do rosto (128 números) é
-- dado biométrico (LGPD art. 11): fica só no servidor (RLS ligado, sem
-- política para o navegador) e a tela tem botão para apagar tudo.
--
-- Migration ADITIVA: duas tabelas novas e uma coluna nova em tabela do próprio
-- Engajamento (engajamento_publicacoes, criada em 20261026120000).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. engajamento_pessoas — cada pessoa diferente achada nas fotos
--    centroide = média dos vetores dos rostos dela; é com ele que um rosto
--    novo é comparado. nome/member_id ficam vazios até a equipe dizer quem é.
--    oculta = não entra no relatório (rosto de banner, pessoa de fora...).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.engajamento_pessoas (
  id          uuid primary key default gen_random_uuid(),
  campo_id    uuid not null,
  nome        varchar(255),
  member_id   uuid references public.members(id) on delete set null,
  foto_url    text,
  centroide   real[] not null,
  amostras    integer not null default 1,
  oculta      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index if not exists engajamento_pessoas_campo_idx  on public.engajamento_pessoas(campo_id);
create index if not exists engajamento_pessoas_member_idx on public.engajamento_pessoas(member_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. engajamento_rostos — cada rosto achado em cada foto
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.engajamento_rostos (
  id             uuid primary key default gen_random_uuid(),
  campo_id       uuid not null,
  publicacao_id  uuid not null references public.engajamento_publicacoes(id) on delete cascade,
  imagem_indice  integer not null default 0,
  pessoa_id      uuid references public.engajamento_pessoas(id) on delete set null,
  descritor      real[] not null,
  caixa          jsonb,
  pontuacao      real,
  foto_url       text,
  created_at     timestamptz not null default now()
);
create index if not exists engajamento_rostos_publicacao_idx on public.engajamento_rostos(publicacao_id);
create index if not exists engajamento_rostos_pessoa_idx     on public.engajamento_rostos(pessoa_id);
create index if not exists engajamento_rostos_campo_idx      on public.engajamento_rostos(campo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Publicação já passou pelo reconhecimento?
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.engajamento_publicacoes add column if not exists rostos_analisados_em timestamptz;

alter table public.engajamento_pessoas enable row level security;
alter table public.engajamento_rostos  enable row level security;
