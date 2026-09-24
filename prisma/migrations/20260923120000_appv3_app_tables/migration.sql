-- App Igreja v3: tabelas appv3_*, RLS, funções e storage.
--
-- Migration ADITIVA e idempotente. Não altera nenhuma tabela existente.
-- Fonte: appv3/app/supabase/appv3_schema.sql (manter as duas iguais).
-- Documentação: appv3/docs/05-BANCO-DE-DADOS.md
--
-- Aplicar no banco de referência só com aprovação do dono, depois
-- `prisma migrate resolve --applied 20260923120000_appv3_app_tables` e
-- regerar o baseline pelo painelchurch (ver AGENTS.md).

-- =============================================================================
-- App Igreja v3 — tabelas, RLS, funções e storage
--
-- Aditivo e idempotente: pode rodar várias vezes. Não altera nenhuma tabela
-- existente do saaschurch; só cria objetos com prefixo appv3_.
-- Documentação: appv3/docs/05-BANCO-DE-DADOS.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfil (precisa existir antes das funções de RLS e dos defaults)
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_perfis (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique,
  campo_id      uuid not null references public.campos(id),
  regional_id   uuid references public.regionais(id),
  church_id     uuid references public.churches(id),
  member_id     uuid unique references public.members(id) on delete set null,
  nome          varchar(255) not null,
  celular       varchar(20),
  email         varchar(255),
  avatar_url    text,
  capa_url      text,
  notificacoes  boolean not null default true,
  publico       boolean not null default true,
  vinculado_em  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists appv3_perfis_campo_idx on public.appv3_perfis(campo_id);
create index if not exists appv3_perfis_church_idx on public.appv3_perfis(church_id);

create or replace function public.appv3_meu_perfil_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.appv3_perfis where auth_user_id = auth.uid()
$$;

create or replace function public.appv3_meu_campo_id()
returns uuid language sql stable security definer set search_path = public as $$
  select campo_id from public.appv3_perfis where auth_user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- 2. Igreja Mundial
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_igreja_mundial (
  id               uuid primary key default gen_random_uuid(),
  chave            varchar(64) not null unique default 'padrao', -- 'padrao' ou campo_id
  campo_id         uuid references public.campos(id) on delete cascade,
  nome             varchar(255) not null,
  sigla            varchar(10) not null default 'AD',
  nome_curto       varchar(120) not null default 'ASSEMBLEIA DE DEUS',
  titulo_portal    varchar(255) not null default E'Uma só igreja,\nmuitos campos',
  subtitulo_portal text not null default 'Conheça a liderança mundial e entre no app do seu campo.',
  cnpj             varchar(20),
  logo_url         text,
  radio_nome       varchar(120),
  radio_url        text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create table if not exists public.appv3_mundial_lideres (
  id         uuid primary key default gen_random_uuid(),
  mundial_id uuid not null references public.appv3_igreja_mundial(id) on delete cascade,
  nome       varchar(255) not null,
  cargo      varchar(255),
  desde      varchar(20),
  paises     varchar(20),
  anos       varchar(20),
  citacao    text,
  resumo     text,
  foto_url   text,
  bio        jsonb not null default '[]'::jsonb,
  fotos      jsonb not null default '[]'::jsonb,
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index if not exists appv3_mundial_lideres_mundial_idx on public.appv3_mundial_lideres(mundial_id);

create table if not exists public.appv3_mundial_recursos (
  id         uuid primary key default gen_random_uuid(),
  mundial_id uuid not null references public.appv3_igreja_mundial(id) on delete cascade,
  tag        varchar(60),
  titulo     varchar(255) not null,
  descricao  text,
  cta        varchar(80),
  imagem_url text,
  url        text,
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index if not exists appv3_mundial_recursos_mundial_idx on public.appv3_mundial_recursos(mundial_id);

-- -----------------------------------------------------------------------------
-- 3. Conteúdo
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_eventos (
  id                  uuid primary key default gen_random_uuid(),
  escopo              varchar(10) not null default 'CAMPO' check (escopo in ('MUNDIAL','CAMPO')),
  mundial_id          uuid references public.appv3_igreja_mundial(id) on delete cascade,
  campo_id            uuid references public.campos(id) on delete cascade,
  church_id           uuid references public.churches(id) on delete set null,
  titulo              varchar(255) not null,
  titulo_curto        varchar(120),
  categoria           varchar(80),
  descricao           text,
  local               varchar(255),
  endereco            text,
  inicio              timestamptz not null,
  fim                 timestamptz,
  imagem_url          text,
  capacidade          integer,
  vendidos            integer not null default 0,
  reembolso_ate_horas integer not null default 48,
  cta_texto           varchar(80),
  publicado           boolean not null default false,
  destaque            boolean not null default false,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists appv3_eventos_campo_idx on public.appv3_eventos(campo_id, inicio);
create index if not exists appv3_eventos_mundial_idx on public.appv3_eventos(mundial_id, inicio);

create table if not exists public.appv3_evento_opcoes (
  id        uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.appv3_eventos(id) on delete cascade,
  rotulo    varchar(120) not null,
  preco     numeric(10,2) not null default 0 check (preco >= 0),
  ordem     integer not null default 0,
  ativo     boolean not null default true
);
create index if not exists appv3_evento_opcoes_evento_idx on public.appv3_evento_opcoes(evento_id);

create table if not exists public.appv3_noticias (
  id           uuid primary key default gen_random_uuid(),
  escopo       varchar(10) not null default 'CAMPO' check (escopo in ('MUNDIAL','CAMPO')),
  mundial_id   uuid references public.appv3_igreja_mundial(id) on delete cascade,
  campo_id     uuid references public.campos(id) on delete cascade,
  tag          varchar(60),
  titulo       varchar(255) not null,
  autor        varchar(255),
  corpo        text,
  imagem_url   text,
  publicado_em timestamptz not null default now(),
  publicado    boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists appv3_noticias_campo_idx on public.appv3_noticias(campo_id, publicado_em);
create index if not exists appv3_noticias_mundial_idx on public.appv3_noticias(mundial_id, publicado_em);

create table if not exists public.appv3_midias (
  id           uuid primary key default gen_random_uuid(),
  campo_id     uuid not null references public.campos(id) on delete cascade,
  tipo         varchar(10) not null check (tipo in ('VIDEO','AUDIO')),
  titulo       varchar(255) not null,
  pregador     varchar(255),
  serie        varchar(120),
  descricao    text,
  imagem_url   text,
  url          text,
  duracao_seg  integer not null default 0,
  publicado_em date not null default current_date,
  publicado    boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists appv3_midias_campo_idx on public.appv3_midias(campo_id, publicado_em);

create table if not exists public.appv3_pao_diario (
  id         uuid primary key default gen_random_uuid(),
  campo_id   uuid references public.campos(id) on delete cascade,
  data       date not null,
  titulo     varchar(255) not null,
  pregador   varchar(255),
  tema       varchar(80),
  versiculo  text,
  referencia varchar(80),
  corpo      text,
  oracao     text,
  audio_url  text,
  publicado  boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists appv3_pao_diario_data_idx on public.appv3_pao_diario(campo_id, data);

create table if not exists public.appv3_lideranca (
  id         uuid primary key default gen_random_uuid(),
  campo_id   uuid not null references public.campos(id) on delete cascade,
  church_id  uuid references public.churches(id) on delete set null,
  member_id  uuid references public.members(id) on delete set null,
  nome       varchar(255) not null,
  cargo      varchar(255),
  conjuge    varchar(255),
  foto_url   text,
  palavra    text,
  presidente boolean not null default false,
  ordem      integer not null default 0,
  ativo      boolean not null default true
);
create index if not exists appv3_lideranca_campo_idx on public.appv3_lideranca(campo_id);

create table if not exists public.appv3_igreja_perfil (
  church_id uuid primary key references public.churches(id) on delete cascade,
  foto_url  text,
  historia  text,
  marcos    jsonb not null default '[]'::jsonb
);

create table if not exists public.appv3_ministerio_info (
  ministry_id uuid primary key references public.ministries(id) on delete cascade,
  publico     varchar(120),
  agenda      varchar(120),
  imagem_url  text
);

create table if not exists public.appv3_convite_modelos (
  id         uuid primary key default gen_random_uuid(),
  campo_id   uuid not null references public.campos(id) on delete cascade,
  rotulo     varchar(40) not null,
  titulo     varchar(120) not null,
  cor        varchar(9) not null default '#D4F53C',
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora       varchar(5) not null,
  local      varchar(255),
  endereco   text,
  ordem      integer not null default 0,
  ativo      boolean not null default true
);
create index if not exists appv3_convite_modelos_campo_idx on public.appv3_convite_modelos(campo_id);

-- -----------------------------------------------------------------------------
-- 4. Loja
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_produtos (
  id        uuid primary key default gen_random_uuid(),
  campo_id  uuid not null references public.campos(id) on delete cascade,
  nome      varchar(255) not null,
  categoria varchar(60),
  descricao text,
  preco     numeric(10,2) not null check (preco >= 0),
  novo      boolean not null default false,
  tamanhos  text[] not null default '{}',
  estoque   integer,
  ativo     boolean not null default true,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists appv3_produtos_campo_idx on public.appv3_produtos(campo_id);

create table if not exists public.appv3_produto_cores (
  id         uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.appv3_produtos(id) on delete cascade,
  nome       varchar(60) not null,
  hex        varchar(9) not null,
  ordem      integer not null default 0
);
create index if not exists appv3_produto_cores_produto_idx on public.appv3_produto_cores(produto_id);

create table if not exists public.appv3_produto_imagens (
  id         uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.appv3_produtos(id) on delete cascade,
  cor_id     uuid references public.appv3_produto_cores(id) on delete cascade,
  vista      varchar(30) not null default 'Frente',
  url        text not null,
  ordem      integer not null default 0
);
create index if not exists appv3_produto_imagens_produto_idx on public.appv3_produto_imagens(produto_id);

create table if not exists public.appv3_loja_destaques (
  id        uuid primary key default gen_random_uuid(),
  campo_id  uuid not null references public.campos(id) on delete cascade,
  kicker    varchar(80),
  titulo    varchar(120) not null,
  cta       varchar(60) not null default 'Ver coleção',
  categoria varchar(60),
  ativo     boolean not null default true,
  ordem     integer not null default 0
);

-- -----------------------------------------------------------------------------
-- 5. Pessoa
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_tentativas_vinculo (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  sucesso      boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists appv3_tentativas_vinculo_user_idx on public.appv3_tentativas_vinculo(auth_user_id, criado_em);

create table if not exists public.appv3_status (
  perfil_id uuid primary key default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  texto     varchar(120) not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.appv3_seguidores (
  seguidor_id uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  seguido_id  uuid not null references public.appv3_perfis(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);
create index if not exists appv3_seguidores_seguido_idx on public.appv3_seguidores(seguido_id);

create table if not exists public.appv3_familiares (
  id                uuid primary key default gen_random_uuid(),
  perfil_id         uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  nome              varchar(255) not null,
  parentesco        varchar(40) not null,
  geracao           smallint not null check (geracao between 1 and 4),
  nucleo            varchar(64) not null,
  eu                boolean not null default false,
  related_member_id uuid references public.members(id) on delete set null,
  criado_em         timestamptz not null default now()
);
create index if not exists appv3_familiares_perfil_idx on public.appv3_familiares(perfil_id);

create table if not exists public.appv3_notificacoes (
  id        uuid primary key default gen_random_uuid(),
  campo_id  uuid not null references public.campos(id) on delete cascade,
  perfil_id uuid references public.appv3_perfis(id) on delete cascade,
  tipo      varchar(10) not null default 'EVENT' check (tipo in ('LIVE','USER','EVENT','SEC','GF','ORDER')),
  titulo    varchar(255) not null,
  corpo     text,
  link      text,
  criado_em timestamptz not null default now()
);
create index if not exists appv3_notificacoes_campo_idx on public.appv3_notificacoes(campo_id, criado_em);
create index if not exists appv3_notificacoes_perfil_idx on public.appv3_notificacoes(perfil_id);

create table if not exists public.appv3_notificacao_leituras (
  notificacao_id uuid not null references public.appv3_notificacoes(id) on delete cascade,
  perfil_id      uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  lida_em        timestamptz not null default now(),
  primary key (notificacao_id, perfil_id)
);

-- -----------------------------------------------------------------------------
-- 6. Secretaria
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_solicitacoes (
  id            uuid primary key default gen_random_uuid(),
  protocolo     bigserial not null unique,
  perfil_id     uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  campo_id      uuid references public.campos(id),
  church_id     uuid references public.churches(id),
  member_id     uuid references public.members(id) on delete set null,
  tipo          varchar(60) not null,
  descricao     text,
  status        varchar(20) not null default 'EM_ANALISE'
                check (status in ('EM_ANALISE','AGUARDANDO_LINK','LINK_ENVIADO','CONCLUIDA','RECUSADA','CANCELADA')),
  dados         jsonb not null default '{}'::jsonb,
  anexo_path    text,
  link_url      text,
  resposta      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists appv3_solicitacoes_perfil_idx on public.appv3_solicitacoes(perfil_id, criado_em);
create index if not exists appv3_solicitacoes_campo_idx on public.appv3_solicitacoes(campo_id, status);

-- Preenche campo/igreja/membro a partir do perfil de quem cria: o app não
-- manda esses ids e não consegue forjá-los.
create or replace function public.appv3_solicitacoes_preencher()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where id = new.perfil_id;
  new.campo_id  := p.campo_id;
  new.church_id := p.church_id;
  new.member_id := p.member_id;
  return new;
end $$;
drop trigger if exists appv3_solicitacoes_preencher on public.appv3_solicitacoes;
create trigger appv3_solicitacoes_preencher before insert on public.appv3_solicitacoes
  for each row execute function public.appv3_solicitacoes_preencher();

-- -----------------------------------------------------------------------------
-- 7. Dinheiro
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_pix_config (
  id         uuid primary key default gen_random_uuid(),
  escopo     varchar(10) not null default 'CAMPO' check (escopo in ('MUNDIAL','CAMPO')),
  mundial_id uuid references public.appv3_igreja_mundial(id) on delete cascade,
  campo_id   uuid references public.campos(id) on delete cascade,
  finalidade varchar(10) not null check (finalidade in ('DIZIMO','OFERTA','LOJA')),
  favorecido varchar(120) not null,
  cnpj       varchar(20),
  cidade     varchar(60) not null default 'BRASIL',
  tipo_chave varchar(12) not null check (tipo_chave in ('EMAIL','TELEFONE','CNPJ','CPF','ALEATORIA')),
  chave      varchar(120) not null,
  ordem      integer not null default 0,
  ativo      boolean not null default true
);

create table if not exists public.appv3_cartoes (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.appv3_perfis(id) on delete cascade,
  bandeira      varchar(20) not null,
  final         varchar(4) not null,
  validade      varchar(5) not null,
  gateway       varchar(30) not null,
  gateway_token text not null,
  criado_em     timestamptz not null default now()
);
create index if not exists appv3_cartoes_perfil_idx on public.appv3_cartoes(perfil_id);

create table if not exists public.appv3_contribuicoes (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.appv3_perfis(id) on delete cascade,
  campo_id      uuid not null references public.campos(id),
  church_id     uuid references public.churches(id),
  member_id     uuid references public.members(id) on delete set null,
  tipo          varchar(10) not null check (tipo in ('DIZIMO','OFERTA')),
  valor         numeric(12,2) not null check (valor > 0),
  descricao     varchar(120),
  metodo        varchar(10) not null check (metodo in ('PIX','CARTAO')),
  cartao_desc   varchar(60),
  status        varchar(25) not null default 'AGUARDANDO_CONFERENCIA'
                check (status in ('AGUARDANDO_CONFERENCIA','CONFIRMADA','RECUSADA','CANCELADA')),
  autenticacao  varchar(20) not null unique,
  pix_txid      varchar(25),
  criado_em     timestamptz not null default now(),
  confirmado_em timestamptz
);
create index if not exists appv3_contribuicoes_perfil_idx on public.appv3_contribuicoes(perfil_id, criado_em);
create index if not exists appv3_contribuicoes_campo_idx on public.appv3_contribuicoes(campo_id, status);

create table if not exists public.appv3_pedidos (
  id          uuid primary key default gen_random_uuid(),
  numero      bigserial not null unique,
  perfil_id   uuid not null references public.appv3_perfis(id) on delete cascade,
  campo_id    uuid not null references public.campos(id),
  church_id   uuid references public.churches(id),
  subtotal    numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  metodo      varchar(10) not null check (metodo in ('PIX','CARTAO','GRATUITO')),
  parcelas    smallint not null default 1 check (parcelas between 1 and 12),
  status      varchar(25) not null default 'AGUARDANDO_PAGAMENTO'
              check (status in ('AGUARDANDO_PAGAMENTO','AGUARDANDO_CONFERENCIA','PAGO','EM_SEPARACAO','ENTREGUE','REEMBOLSO_SOLICITADO','REEMBOLSADO','CANCELADO')),
  entrega     varchar(120) not null default 'Retirar na secretaria',
  pix_txid    varchar(25),
  gateway_ref text,
  criado_em   timestamptz not null default now(),
  pago_em     timestamptz
);
create index if not exists appv3_pedidos_perfil_idx on public.appv3_pedidos(perfil_id, criado_em);
create index if not exists appv3_pedidos_campo_idx on public.appv3_pedidos(campo_id, status);

create table if not exists public.appv3_pedido_itens (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.appv3_pedidos(id) on delete cascade,
  tipo       varchar(10) not null check (tipo in ('PRODUTO','INGRESSO')),
  produto_id uuid references public.appv3_produtos(id) on delete set null,
  evento_id  uuid references public.appv3_eventos(id) on delete set null,
  opcao_id   uuid references public.appv3_evento_opcoes(id) on delete set null,
  nome       varchar(255) not null,
  variante   varchar(255),
  tamanho    varchar(10),
  cor        varchar(60),
  quantidade integer not null check (quantidade > 0),
  preco_unit numeric(10,2) not null,
  total      numeric(12,2) not null
);
create index if not exists appv3_pedido_itens_pedido_idx on public.appv3_pedido_itens(pedido_id);

create table if not exists public.appv3_ingressos (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.appv3_pedidos(id) on delete cascade,
  item_id       uuid references public.appv3_pedido_itens(id) on delete cascade,
  perfil_id     uuid not null references public.appv3_perfis(id) on delete cascade,
  evento_id     uuid references public.appv3_eventos(id) on delete set null,
  opcao_id      uuid references public.appv3_evento_opcoes(id) on delete set null,
  codigo        varchar(20) not null unique,
  rotulo        varchar(120),
  quantidade    integer not null default 1,
  valor_pago    numeric(12,2) not null default 0,
  status        varchar(25) not null default 'AGUARDANDO_PAGAMENTO'
                check (status in ('AGUARDANDO_PAGAMENTO','ATIVO','UTILIZADO','REEMBOLSO_SOLICITADO','CANCELADO')),
  reembolso_ate timestamptz,
  criado_em     timestamptz not null default now()
);
create index if not exists appv3_ingressos_perfil_idx on public.appv3_ingressos(perfil_id, criado_em);

create table if not exists public.appv3_reembolsos (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.appv3_perfis(id) on delete cascade,
  pedido_id   uuid references public.appv3_pedidos(id) on delete cascade,
  ingresso_id uuid references public.appv3_ingressos(id) on delete cascade,
  motivo      varchar(120) not null,
  valor       numeric(12,2) not null,
  status      varchar(12) not null default 'SOLICITADO' check (status in ('SOLICITADO','APROVADO','NEGADO','PAGO')),
  criado_em   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 8. EBD e jogos
-- -----------------------------------------------------------------------------
create table if not exists public.appv3_ebd_licoes (
  id         uuid primary key default gen_random_uuid(),
  campo_id   uuid not null references public.campos(id) on delete cascade,
  trimestre  varchar(30) not null,
  numero     integer not null,
  titulo     varchar(255) not null,
  texto_base varchar(120),
  data       date not null,
  conteudo   text,
  publicado  boolean not null default false
);
create index if not exists appv3_ebd_licoes_campo_idx on public.appv3_ebd_licoes(campo_id, data);

create table if not exists public.appv3_ebd_turmas (
  id        uuid primary key default gen_random_uuid(),
  campo_id  uuid not null references public.campos(id) on delete cascade,
  church_id uuid references public.churches(id) on delete cascade,
  nome      varchar(120) not null,
  professor varchar(255),
  sala      varchar(60),
  ordem     integer not null default 0,
  ativo     boolean not null default true
);

create table if not exists public.appv3_ebd_matriculas (
  id        uuid primary key default gen_random_uuid(),
  turma_id  uuid not null references public.appv3_ebd_turmas(id) on delete cascade,
  perfil_id uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  status    varchar(12) not null default 'SOLICITADA' check (status in ('SOLICITADA','ATIVA','CANCELADA')),
  criado_em timestamptz not null default now(),
  unique (turma_id, perfil_id)
);

create table if not exists public.appv3_jogos_conteudo (
  id        uuid primary key default gen_random_uuid(),
  campo_id  uuid references public.campos(id) on delete cascade,
  jogo      varchar(10) not null check (jogo in ('QUIZ','VF','FORCA','CRUZADAS')),
  licao_id  uuid references public.appv3_ebd_licoes(id) on delete set null,
  dados     jsonb not null,
  ordem     integer not null default 0,
  ativo     boolean not null default true
);

create table if not exists public.appv3_jogos_pontos (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null default public.appv3_meu_perfil_id() references public.appv3_perfis(id) on delete cascade,
  jogo      varchar(10) not null check (jogo in ('QUIZ','VF','FORCA','CRUZADAS')),
  pontos    integer not null check (pontos between 0 and 100),
  criado_em timestamptz not null default now()
);
create index if not exists appv3_jogos_pontos_perfil_idx on public.appv3_jogos_pontos(perfil_id);

-- =============================================================================
-- 9. Permissões de tabela (explícitas: nada herdado do default do Supabase)
-- =============================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'appv3\_%' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- conteúdo: leitura pública
grant select on public.appv3_igreja_mundial, public.appv3_mundial_lideres, public.appv3_mundial_recursos,
  public.appv3_eventos, public.appv3_evento_opcoes, public.appv3_noticias, public.appv3_midias,
  public.appv3_pao_diario, public.appv3_lideranca, public.appv3_igreja_perfil, public.appv3_ministerio_info,
  public.appv3_convite_modelos, public.appv3_produtos, public.appv3_produto_cores, public.appv3_produto_imagens,
  public.appv3_loja_destaques, public.appv3_pix_config, public.appv3_ebd_licoes, public.appv3_ebd_turmas,
  public.appv3_jogos_conteudo
  to anon, authenticated;

-- da pessoa
grant select on public.appv3_perfis to authenticated;
grant update (nome, celular, avatar_url, capa_url, notificacoes, publico) on public.appv3_perfis to authenticated;
grant select, insert, update, delete on public.appv3_status to authenticated;
grant select, insert, delete on public.appv3_seguidores to authenticated;
grant select, insert, update, delete on public.appv3_familiares to authenticated;
grant select on public.appv3_notificacoes to authenticated;
grant select, insert on public.appv3_notificacao_leituras to authenticated;
grant select, insert on public.appv3_solicitacoes to authenticated;
grant usage on sequence public.appv3_solicitacoes_protocolo_seq to authenticated;
grant select, delete on public.appv3_cartoes to authenticated;
grant select on public.appv3_contribuicoes, public.appv3_pedidos, public.appv3_pedido_itens,
  public.appv3_ingressos, public.appv3_reembolsos to authenticated;
grant select, insert, delete on public.appv3_ebd_matriculas to authenticated;
grant select, insert on public.appv3_jogos_pontos to authenticated;

-- =============================================================================
-- 10. Políticas RLS
-- =============================================================================
do $$
declare t text;
begin
  -- conteúdo com coluna publicado/ativo
  foreach t in array array['appv3_eventos','appv3_noticias','appv3_midias','appv3_pao_diario','appv3_ebd_licoes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (publicado)', t || '_leitura', t);
  end loop;
  foreach t in array array['appv3_igreja_mundial','appv3_mundial_lideres','appv3_mundial_recursos','appv3_evento_opcoes',
                           'appv3_lideranca','appv3_convite_modelos','appv3_produtos','appv3_loja_destaques',
                           'appv3_pix_config','appv3_ebd_turmas','appv3_jogos_conteudo'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (ativo)', t || '_leitura', t);
  end loop;
  foreach t in array array['appv3_igreja_perfil','appv3_ministerio_info','appv3_produto_cores','appv3_produto_imagens'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_leitura', t);
  end loop;
  -- tabelas da pessoa com perfil_id
  foreach t in array array['appv3_familiares','appv3_cartoes','appv3_contribuicoes','appv3_pedidos','appv3_ingressos',
                           'appv3_reembolsos','appv3_solicitacoes','appv3_ebd_matriculas','appv3_jogos_pontos',
                           'appv3_notificacao_leituras'] loop
    execute format('drop policy if exists %I on public.%I', t || '_dono', t);
    execute format('create policy %I on public.%I for all to authenticated using (perfil_id = public.appv3_meu_perfil_id()) with check (perfil_id = public.appv3_meu_perfil_id())', t || '_dono', t);
  end loop;
end $$;

drop policy if exists appv3_perfis_dono on public.appv3_perfis;
create policy appv3_perfis_dono on public.appv3_perfis for all to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy if exists appv3_pedido_itens_dono on public.appv3_pedido_itens;
create policy appv3_pedido_itens_dono on public.appv3_pedido_itens for select to authenticated
  using (exists (select 1 from public.appv3_pedidos p where p.id = pedido_id and p.perfil_id = public.appv3_meu_perfil_id()));

drop policy if exists appv3_solicitacoes_status_inicial on public.appv3_solicitacoes;
create policy appv3_solicitacoes_status_inicial on public.appv3_solicitacoes as restrictive for insert to authenticated
  with check (status in ('EM_ANALISE','AGUARDANDO_LINK'));

drop policy if exists appv3_status_leitura on public.appv3_status;
create policy appv3_status_leitura on public.appv3_status for select to authenticated
  using (perfil_id = public.appv3_meu_perfil_id()
         or (expira_em > now() and exists (select 1 from public.appv3_perfis p where p.id = perfil_id and p.campo_id = public.appv3_meu_campo_id())));
drop policy if exists appv3_status_dono on public.appv3_status;
create policy appv3_status_dono on public.appv3_status for all to authenticated
  using (perfil_id = public.appv3_meu_perfil_id()) with check (perfil_id = public.appv3_meu_perfil_id());

drop policy if exists appv3_seguidores_leitura on public.appv3_seguidores;
create policy appv3_seguidores_leitura on public.appv3_seguidores for select to authenticated
  using (exists (select 1 from public.appv3_perfis p where p.id = seguido_id and p.campo_id = public.appv3_meu_campo_id()));
drop policy if exists appv3_seguidores_dono on public.appv3_seguidores;
create policy appv3_seguidores_dono on public.appv3_seguidores for insert to authenticated
  with check (seguidor_id = public.appv3_meu_perfil_id()
              and exists (select 1 from public.appv3_perfis p where p.id = seguido_id and p.campo_id = public.appv3_meu_campo_id()));
drop policy if exists appv3_seguidores_apagar on public.appv3_seguidores;
create policy appv3_seguidores_apagar on public.appv3_seguidores for delete to authenticated
  using (seguidor_id = public.appv3_meu_perfil_id());

drop policy if exists appv3_notificacoes_leitura on public.appv3_notificacoes;
create policy appv3_notificacoes_leitura on public.appv3_notificacoes for select to authenticated
  using (campo_id = public.appv3_meu_campo_id() and (perfil_id is null or perfil_id = public.appv3_meu_perfil_id()));

-- =============================================================================
-- 11. Funções auxiliares
-- =============================================================================
create or replace function public.appv3_digitos(t text)
returns text language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

create or replace function public.appv3_status_membro(t text)
returns text language sql immutable as $$
  select case
    when t is null then null
    when upper(translate(t, 'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) like 'ATIV%' then 'ATIVO'
    else upper(t) end
$$;

create or replace function public.appv3_campo_da_igreja(p_church uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select r.campo_id from public.churches c join public.regionais r on r.id = c.regional_id where c.id = p_church
$$;

-- -----------------------------------------------------------------------------
-- Estrutura pública: campos → regionais → igrejas (sem dado pessoal)
-- -----------------------------------------------------------------------------
create or replace function public.appv3_estrutura_publica()
returns jsonb language sql stable security definer set search_path = public as $$
  with igrejas as (
    select c.id, c.regional_id, c.address_city, c.address_state,
           case when count(*) over (partition by c.regional_id, lower(c.name)) > 1 and c.periodo in ('M','T','N')
                then c.name || ' · ' || case c.periodo when 'M' then 'Manhã' when 'T' then 'Tarde' else 'Noite' end
                else c.name end as nome
      from public.churches c
     where c.deleted_at is null and coalesce(c.status, 'active') <> 'inactive'
  )
  select coalesce(jsonb_agg(x order by x->>'nome'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', ca.id,
      'nome', ca.name,
      'codigo', ca.code,
      'cidade', coalesce(
        (select h.city || coalesce(', ' || h.state, '') from public.headquarters h where h.field_id = ca.id and h.city is not null limit 1),
        (select i.address_city || coalesce(', ' || i.address_state, '') from igrejas i join public.regionais r on r.id = i.regional_id
          where r.campo_id = ca.id and i.address_city is not null group by 1 order by count(*) desc limit 1)),
      'regionais', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', r.id, 'nome', r.name,
                 'igrejas', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'cidade', i.address_city) order by i.nome)
                                        from igrejas i where i.regional_id = r.id), '[]'::jsonb))
               order by r.name)
          from public.regionais r where r.campo_id = ca.id and r.deleted_at is null), '[]'::jsonb)
    ) x
    from public.campos ca where ca.deleted_at is null
  ) s
$$;

-- -----------------------------------------------------------------------------
-- Igreja Mundial num JSON só (portão público)
-- -----------------------------------------------------------------------------
create or replace function public.appv3_mundial_publico(p_campo uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.appv3_igreja_mundial;
begin
  if p_campo is not null then
    select * into m from public.appv3_igreja_mundial where chave = p_campo::text and ativo;
  end if;
  if m.id is null then
    select * into m from public.appv3_igreja_mundial where chave = 'padrao' and ativo;
  end if;
  if m.id is null then return null; end if;

  return jsonb_build_object(
    'mundial', to_jsonb(m),
    'lideres', coalesce((select jsonb_agg(to_jsonb(l) order by l.ordem) from public.appv3_mundial_lideres l
                          where l.mundial_id = m.id and l.ativo), '[]'::jsonb),
    'recursos', coalesce((select jsonb_agg(to_jsonb(r) order by r.ordem) from public.appv3_mundial_recursos r
                           where r.mundial_id = m.id and r.ativo), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(to_jsonb(e) order by e.inicio) from public.appv3_eventos e
                          where e.mundial_id = m.id and e.escopo = 'MUNDIAL' and e.publicado
                            and coalesce(e.fim, e.inicio) >= now() - interval '1 day'), '[]'::jsonb),
    'noticias', coalesce((select jsonb_agg(to_jsonb(n) order by n.publicado_em desc) from (
                            select * from public.appv3_noticias
                             where mundial_id = m.id and escopo = 'MUNDIAL' and publicado
                             order by publicado_em desc limit 10) n), '[]'::jsonb),
    'pix', coalesce((select jsonb_agg(to_jsonb(p) order by p.finalidade, p.ordem) from public.appv3_pix_config p
                      where p.mundial_id = m.id and p.escopo = 'MUNDIAL' and p.ativo), '[]'::jsonb)
  );
end $$;

-- -----------------------------------------------------------------------------
-- Perfil e vínculo com o membro
-- -----------------------------------------------------------------------------
create or replace function public.appv3_criar_perfil(p_campo uuid, p_regional uuid, p_igreja uuid, p_nome text, p_celular text)
returns public.appv3_perfis language plpgsql security definer set search_path = public as $$
declare p public.appv3_perfis; v_email text;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not exists (select 1 from public.churches c join public.regionais r on r.id = c.regional_id
                  where c.id = p_igreja and r.id = p_regional and r.campo_id = p_campo) then
    raise exception 'IGREJA_INVALIDA';
  end if;
  select email into v_email from auth.users where id = auth.uid();

  insert into public.appv3_perfis (auth_user_id, campo_id, regional_id, church_id, nome, celular, email)
  values (auth.uid(), p_campo, p_regional, p_igreja, coalesce(nullif(trim(p_nome), ''), split_part(v_email, '@', 1)),
          nullif(trim(p_celular), ''), v_email)
  on conflict (auth_user_id) do update
     set campo_id    = case when appv3_perfis.member_id is null then excluded.campo_id else appv3_perfis.campo_id end,
         regional_id = case when appv3_perfis.member_id is null then excluded.regional_id else appv3_perfis.regional_id end,
         church_id   = case when appv3_perfis.member_id is null then excluded.church_id else appv3_perfis.church_id end,
         nome        = case when nullif(trim(p_nome), '') is null then appv3_perfis.nome else excluded.nome end,
         celular     = coalesce(excluded.celular, appv3_perfis.celular),
         email       = excluded.email,
         atualizado_em = now()
  returning * into p;
  return p;
end $$;

create or replace function public.appv3_localizar_membro(p_campo uuid, p_rol text, p_cpf text, p_telefone text)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id
    from public.members m
    join public.churches c on c.id = m.church_id
    join public.regionais r on r.id = coalesce(m.regional_id, c.regional_id)
   where m.deleted_at is null
     and m.rol = nullif(public.appv3_digitos(p_rol), '')::int
     and public.appv3_digitos(m.cpf) = public.appv3_digitos(p_cpf)
     and length(public.appv3_digitos(p_telefone)) >= 8
     and (right(public.appv3_digitos(m.mobile), 8) = right(public.appv3_digitos(p_telefone), 8)
          or right(public.appv3_digitos(m.phone), 8) = right(public.appv3_digitos(p_telefone), 8))
     and coalesce(m.campo_id, r.campo_id) = p_campo
   limit 1
$$;
revoke all on function public.appv3_localizar_membro(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.appv3_freio_vinculo()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if (select count(*) from public.appv3_tentativas_vinculo
       where auth_user_id = auth.uid() and criado_em > now() - interval '1 hour') >= 5 then
    raise exception 'LIMITE_TENTATIVAS';
  end if;
end $$;
revoke all on function public.appv3_freio_vinculo() from public, anon, authenticated;

create or replace function public.appv3_buscar_membro(p_campo uuid, p_rol text, p_cpf text, p_telefone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v jsonb;
begin
  perform public.appv3_freio_vinculo();
  v_id := public.appv3_localizar_membro(p_campo, p_rol, p_cpf, p_telefone);
  insert into public.appv3_tentativas_vinculo (auth_user_id, sucesso) values (auth.uid(), v_id is not null);
  if v_id is null then return null; end if;

  select jsonb_build_object(
    'nome', m.full_name,
    'cargo', coalesce(et.name, m.ecclesiastical_title),
    'rol', m.rol,
    'status', public.appv3_status_membro(m.membership_status),
    'foto_url', m.photo_url,
    'campo', ca.name,
    'regional', r.name,
    'igreja', c.name,
    'membro_desde', extract(year from m.membership_date)::int,
    'ja_vinculado', exists (select 1 from public.appv3_perfis p where p.member_id = m.id and p.auth_user_id <> auth.uid()))
  into v
  from public.members m
  join public.churches c on c.id = m.church_id
  join public.regionais r on r.id = coalesce(m.regional_id, c.regional_id)
  join public.campos ca on ca.id = coalesce(m.campo_id, r.campo_id)
  left join public.ecclesiastical_titles et on et.id = m.ecclesiastical_title_id
  where m.id = v_id;
  return v;
end $$;

create or replace function public.appv3_vincular_membro(p_campo uuid, p_rol text, p_cpf text, p_telefone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; m public.members; v_regional uuid; v_campo uuid; v_email text;
begin
  perform public.appv3_freio_vinculo();
  v_id := public.appv3_localizar_membro(p_campo, p_rol, p_cpf, p_telefone);
  insert into public.appv3_tentativas_vinculo (auth_user_id, sucesso) values (auth.uid(), v_id is not null);
  if v_id is null then raise exception 'MEMBRO_NAO_ENCONTRADO'; end if;
  if exists (select 1 from public.appv3_perfis where member_id = v_id and auth_user_id <> auth.uid()) then
    raise exception 'MEMBRO_JA_VINCULADO';
  end if;

  select * into m from public.members where id = v_id;
  select c.regional_id into v_regional from public.churches c where c.id = m.church_id;
  v_regional := coalesce(m.regional_id, v_regional);
  select coalesce(m.campo_id, r.campo_id) into v_campo from public.regionais r where r.id = v_regional;
  select email into v_email from auth.users where id = auth.uid();

  insert into public.appv3_perfis (auth_user_id, campo_id, regional_id, church_id, member_id, nome, celular, email, vinculado_em)
  values (auth.uid(), v_campo, v_regional, m.church_id, m.id, m.full_name, coalesce(m.mobile, m.phone), v_email, now())
  on conflict (auth_user_id) do update
     set campo_id = excluded.campo_id, regional_id = excluded.regional_id, church_id = excluded.church_id,
         member_id = excluded.member_id, nome = excluded.nome,
         celular = coalesce(appv3_perfis.celular, excluded.celular),
         vinculado_em = now(), atualizado_em = now();

  return public.appv3_meu_cartao();
end $$;

-- -----------------------------------------------------------------------------
-- Carteirinha e contadores do perfil
-- -----------------------------------------------------------------------------
create or replace function public.appv3_meu_cartao()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.appv3_perfis; v jsonb;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return null; end if;

  select jsonb_build_object(
    'perfil_id', p.id,
    'nome', coalesce(m.full_name, p.nome),
    'email', coalesce(p.email, m.email),
    'celular', coalesce(p.celular, m.mobile, m.phone),
    'avatar_url', coalesce(p.avatar_url, m.photo_url),
    'capa_url', coalesce(p.capa_url, m.cover_photo_url),
    'notificacoes', p.notificacoes,
    'publico', p.publico,
    'vinculado', p.member_id is not null,
    'member_id', p.member_id,
    'campo_id', p.campo_id, 'campo', ca.name,
    'regional_id', p.regional_id, 'regional', r.name,
    'church_id', p.church_id, 'igreja', c.name,
    'cidade', nullif(concat_ws(', ', c.address_city, c.address_state), ''),
    'cargo', coalesce(et.name, m.ecclesiastical_title),
    'status', public.appv3_status_membro(m.membership_status),
    'rol', m.rol,
    'membro_desde', extract(year from m.membership_date)::int,
    'nascimento', m.birth_date,
    'estado_civil', m.marital_status,
    'endereco', nullif(concat_ws(', ', nullif(concat_ws(', ', m.address_street, m.address_number), ''), m.address_neighborhood), ''),
    'batismo_data', coalesce(m.baptism_date, (select b.baptism_date from public.baptisms b where b.member_id = m.id and b.deleted_at is null order by b.baptism_date desc limit 1)),
    'batismo_local', (select b.location from public.baptisms b where b.member_id = m.id and b.deleted_at is null order by b.baptism_date desc limit 1),
    'seguidores', (select count(*) from public.appv3_seguidores s where s.seguido_id = p.id),
    'seguindo', (select count(*) from public.appv3_seguidores s where s.seguidor_id = p.id),
    'pedidos', (select count(*) from public.appv3_pedidos x where x.perfil_id = p.id),
    'ingressos_ativos', (select count(*) from public.appv3_ingressos x where x.perfil_id = p.id and x.status in ('ATIVO','AGUARDANDO_PAGAMENTO')),
    'solicitacoes_abertas', (select count(*) from public.appv3_solicitacoes x where x.perfil_id = p.id and x.status in ('EM_ANALISE','AGUARDANDO_LINK')),
    'contribuicoes', (select count(*) from public.appv3_contribuicoes x where x.perfil_id = p.id),
    'pontos', (select coalesce(sum(pontos), 0) from public.appv3_jogos_pontos x where x.perfil_id = p.id),
    'status_24h', (select to_jsonb(s) from public.appv3_status s where s.perfil_id = p.id and s.expira_em > now()))
  into v
  from public.campos ca
  left join public.regionais r on r.id = p.regional_id
  left join public.churches c on c.id = p.church_id
  left join public.members m on m.id = p.member_id
  left join public.ecclesiastical_titles et on et.id = m.ecclesiastical_title_id
  where ca.id = p.campo_id;
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- Igreja do usuário (página Igreja, cultos, cabeçalho)
-- -----------------------------------------------------------------------------
create or replace function public.appv3_minha_igreja()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.appv3_perfis; c public.churches; h public.headquarters;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return null; end if;
  select * into c from public.churches where id = p.church_id;
  select * into h from public.headquarters where id = c.headquarters_id;
  if h.id is null then
    select * into h from public.headquarters where field_id = p.campo_id order by created_at limit 1;
  end if;

  return jsonb_build_object(
    'igreja', jsonb_build_object(
      'id', c.id, 'nome', c.name,
      'rua', nullif(concat_ws(', ', c.address_street, c.address_number), ''),
      'bairro', c.address_neighborhood, 'cidade', c.address_city, 'uf', c.address_state,
      'latitude', c.latitude, 'longitude', c.longitude,
      'telefone', coalesce(c.phone, h.contact), 'whatsapp', coalesce(c.whatsapp, h.whatsapp),
      'email', coalesce(c.email, h.email), 'site', coalesce(c.website, h.site),
      'logo_url', c.logo_url),
    'sede', case when h.id is null then null else jsonb_build_object(
      'id', h.id, 'nome', h.name, 'instagram', h.instagram, 'youtube', h.youtube, 'facebook', h.facebook,
      'rua', nullif(concat_ws(', ', h.street, h.number), ''), 'bairro', h.neighborhood, 'cidade', h.city, 'uf', h.state,
      'cnpj', h.cnpj) end,
    'campo', (select jsonb_build_object('id', ca.id, 'nome', ca.name) from public.campos ca where ca.id = p.campo_id),
    'cultos', coalesce((select jsonb_agg(jsonb_build_object('dia', s.day_of_week, 'nome', s.name, 'hora', s.time) order by s."order")
                          from public.church_schedule s where s.headquarters_id = h.id), '[]'::jsonb),
    'perfil', (select to_jsonb(ip) from public.appv3_igreja_perfil ip where ip.church_id = c.id)
  );
end $$;

-- -----------------------------------------------------------------------------
-- Diretório de membros (só perfis públicos do mesmo campo)
-- -----------------------------------------------------------------------------
create or replace function public.appv3_linha_diretorio(p_alvo uuid, p_eu uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil_id', pp.id,
    'nome', coalesce(m.full_name, pp.nome),
    'avatar_url', coalesce(pp.avatar_url, m.photo_url),
    'capa_url', coalesce(pp.capa_url, m.cover_photo_url),
    'cargo', coalesce(et.name, m.ecclesiastical_title, 'Visitante'),
    'igreja', c.name, 'regional', r.name, 'regional_id', r.id, 'campo', ca.name,
    'membro_desde', extract(year from m.membership_date)::int,
    'ministerio', (select mi.name from public.ministry_members mm join public.ministries mi on mi.id = mm.ministry_id
                    where mm.member_id = m.id and mm.is_active order by mm.joined_at limit 1),
    'status_24h', (select jsonb_build_object('texto', s.texto, 'expira_em', s.expira_em) from public.appv3_status s
                    where s.perfil_id = pp.id and s.expira_em > now()),
    'seguindo', exists (select 1 from public.appv3_seguidores s where s.seguidor_id = p_eu and s.seguido_id = pp.id),
    'segue_voce', exists (select 1 from public.appv3_seguidores s where s.seguidor_id = pp.id and s.seguido_id = p_eu),
    'seguidores', (select count(*) from public.appv3_seguidores s where s.seguido_id = pp.id),
    'seguindo_total', (select count(*) from public.appv3_seguidores s where s.seguidor_id = pp.id))
  from public.appv3_perfis pp
  join public.campos ca on ca.id = pp.campo_id
  left join public.members m on m.id = pp.member_id
  left join public.ecclesiastical_titles et on et.id = m.ecclesiastical_title_id
  left join public.churches c on c.id = pp.church_id
  left join public.regionais r on r.id = pp.regional_id
  where pp.id = p_alvo
$$;
revoke all on function public.appv3_linha_diretorio(uuid, uuid) from public, anon, authenticated;

create or replace function public.appv3_diretorio(p_q text default null, p_regional uuid default null, p_filtro text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare eu public.appv3_perfis;
begin
  select * into eu from public.appv3_perfis where auth_user_id = auth.uid();
  if eu.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(public.appv3_linha_diretorio(pp.id, eu.id) order by pp.nome)
      from (select pp.* from public.appv3_perfis pp
             where pp.campo_id = eu.campo_id and pp.id <> eu.id and pp.publico
               and (p_regional is null or pp.regional_id = p_regional)
               and (coalesce(trim(p_q), '') = '' or pp.nome ilike '%' || trim(p_q) || '%')
               and (p_filtro is null
                    or (p_filtro = 'SEGUIDORES' and exists (select 1 from public.appv3_seguidores s where s.seguidor_id = pp.id and s.seguido_id = eu.id))
                    or (p_filtro = 'SEGUINDO' and exists (select 1 from public.appv3_seguidores s where s.seguidor_id = eu.id and s.seguido_id = pp.id)))
             order by pp.nome limit 200) pp), '[]'::jsonb);
end $$;

create or replace function public.appv3_perfil_publico(p_perfil uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare eu public.appv3_perfis;
begin
  select * into eu from public.appv3_perfis where auth_user_id = auth.uid();
  if eu.id is null or not exists (select 1 from public.appv3_perfis
                                   where id = p_perfil and campo_id = eu.campo_id and (publico or id = eu.id)) then
    return null;
  end if;
  return public.appv3_linha_diretorio(p_perfil, eu.id);
end $$;

-- -----------------------------------------------------------------------------
-- Grupos familiares, ministérios e turmas da EBD do campo
-- -----------------------------------------------------------------------------
create or replace function public.appv3_grupos_familiares()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_campo uuid := public.appv3_meu_campo_id();
begin
  if v_campo is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'nome', g.name, 'descricao', g.description, 'categoria', g.cell_type,
      'dia', g.meeting_day, 'hora', to_char(g.meeting_time, 'HH24:MI'),
      'rua', coalesce(nullif(concat_ws(', ', g.address_street, g.address_number), ''), g.address),
      'bairro', g.address_neighborhood, 'cidade', g.address_city,
      'latitude', g.latitude, 'longitude', g.longitude, 'foto_url', g.photo,
      'igreja', c.name,
      'participantes', (select count(*) from public.cell_group_members gm where gm.cell_group_id = g.id and gm.is_active),
      'lideres', coalesce((select jsonb_agg(jsonb_build_object('nome', m.full_name, 'telefone', coalesce(m.mobile, m.phone)) order by gl.position)
                             from public.cell_group_leaders gl join public.members m on m.id = gl.member_id
                            where gl.cell_group_id = g.id),
                          (select jsonb_build_array(jsonb_build_object('nome', m.full_name, 'telefone', coalesce(m.mobile, m.phone)))
                             from public.members m where m.id = g.leader_id),
                          '[]'::jsonb))
      order by g.name)
    from public.cell_groups g
    join public.churches c on c.id = g.church_id
    join public.regionais r on r.id = c.regional_id
    where r.campo_id = v_campo and g.deleted_at is null and coalesce(g.status, 'active') = 'active'), '[]'::jsonb);
end $$;

create or replace function public.appv3_ministerios()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'nome') from (
      select distinct on (lower(mi.name)) jsonb_build_object(
        'id', mi.id, 'nome', mi.name, 'descricao', mi.description, 'cor', mi.color, 'icone', mi.icon,
        'lider', lm.full_name, 'publico', inf.publico, 'agenda', inf.agenda, 'imagem_url', inf.imagem_url) x
      from public.ministries mi
      left join public.churches c on c.id = mi.church_id
      left join public.regionais r on r.id = c.regional_id
      left join public.members lm on lm.id = mi.leader_id
      left join public.appv3_ministerio_info inf on inf.ministry_id = mi.id
      where mi.is_active and mi.deleted_at is null
        and (mi.campo_id = p.campo_id or r.campo_id = p.campo_id)
      order by lower(mi.name), (mi.church_id = p.church_id) desc nulls last, mi.created_at
    ) s), '[]'::jsonb);
end $$;

create or replace function public.appv3_ebd_turmas()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.appv3_perfis;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'nome', t.nome, 'professor', t.professor, 'sala', t.sala,
      'alunos', (select count(*) from public.appv3_ebd_matriculas m where m.turma_id = t.id and m.status <> 'CANCELADA'),
      'minha', exists (select 1 from public.appv3_ebd_matriculas m where m.turma_id = t.id and m.perfil_id = p.id and m.status <> 'CANCELADA'),
      'nomes', coalesce((select jsonb_agg(x.nome) from (
                  select pp.nome from public.appv3_ebd_matriculas m join public.appv3_perfis pp on pp.id = m.perfil_id
                   where m.turma_id = t.id and m.status <> 'CANCELADA' and pp.id <> p.id order by m.criado_em limit 7) x), '[]'::jsonb))
      order by t.ordem, t.nome)
    from public.appv3_ebd_turmas t
    where t.ativo and t.campo_id = p.campo_id and (t.church_id is null or t.church_id = p.church_id)), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- Dinheiro: pedido, Pix informado, contribuição, reembolso
-- -----------------------------------------------------------------------------
create or replace function public.appv3_codigo(p_prefixo text)
returns text language sql volatile as $$
  select p_prefixo || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
                   || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 5, 4))
$$;

create or replace function public.appv3_criar_pedido(p_itens jsonb, p_metodo text, p_parcelas int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.appv3_perfis; it jsonb; ped public.appv3_pedidos; v_item uuid;
  prod public.appv3_produtos; op public.appv3_evento_opcoes; ev public.appv3_eventos;
  v_qtd int; v_total numeric(12,2) := 0; v_cor text; v_tam text; v_status text; v_metodo text;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'CARRINHO_VAZIO'; end if;
  v_metodo := upper(coalesce(p_metodo, 'PIX'));
  if v_metodo not in ('PIX','CARTAO') then raise exception 'METODO_INVALIDO'; end if;
  if v_metodo = 'PIX' then p_parcelas := 1; end if;

  insert into public.appv3_pedidos (perfil_id, campo_id, church_id, metodo, parcelas, status)
  values (p.id, p.campo_id, p.church_id, v_metodo, greatest(1, least(coalesce(p_parcelas, 1), 3)), 'AGUARDANDO_PAGAMENTO')
  returning * into ped;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_qtd := greatest(1, coalesce((it->>'quantidade')::int, 1));
    if it->>'tipo' = 'PRODUTO' then
      select * into prod from public.appv3_produtos where id = (it->>'produto_id')::uuid and ativo and campo_id = p.campo_id;
      if prod.id is null then raise exception 'PRODUTO_INDISPONIVEL'; end if;
      v_tam := nullif(it->>'tamanho', '');
      if v_tam is not null and not (v_tam = any(prod.tamanhos)) then raise exception 'TAMANHO_INVALIDO'; end if;
      select nome into v_cor from public.appv3_produto_cores where id = nullif(it->>'cor_id', '')::uuid and produto_id = prod.id;
      insert into public.appv3_pedido_itens (pedido_id, tipo, produto_id, nome, variante, tamanho, cor, quantidade, preco_unit, total)
      values (ped.id, 'PRODUTO', prod.id, prod.nome,
              nullif(concat_ws(' · ', 'Tamanho ' || v_tam, v_cor), ''), v_tam, v_cor, v_qtd, prod.preco, prod.preco * v_qtd);
      v_total := v_total + prod.preco * v_qtd;
    elsif it->>'tipo' = 'INGRESSO' then
      select * into op from public.appv3_evento_opcoes where id = (it->>'opcao_id')::uuid and ativo;
      select * into ev from public.appv3_eventos where id = op.evento_id and publicado and escopo = 'CAMPO' and campo_id = p.campo_id
        for update;
      if op.id is null or ev.id is null then raise exception 'EVENTO_INDISPONIVEL'; end if;
      if ev.capacidade is not null and ev.vendidos + v_qtd > ev.capacidade then raise exception 'EVENTO_ESGOTADO'; end if;
      update public.appv3_eventos set vendidos = vendidos + v_qtd where id = ev.id;
      insert into public.appv3_pedido_itens (pedido_id, tipo, evento_id, opcao_id, nome, variante, quantidade, preco_unit, total)
      values (ped.id, 'INGRESSO', ev.id, op.id, coalesce(ev.titulo_curto, ev.titulo), op.rotulo, v_qtd, op.preco, op.preco * v_qtd)
      returning id into v_item;
      insert into public.appv3_ingressos (pedido_id, item_id, perfil_id, evento_id, opcao_id, codigo, rotulo, quantidade, valor_pago, status, reembolso_ate)
      values (ped.id, v_item, p.id, ev.id, op.id, public.appv3_codigo('ING'),
              op.rotulo || ' · ' || v_qtd || case when v_qtd > 1 then ' ingressos' else ' ingresso' end,
              v_qtd, op.preco * v_qtd,
              case when op.preco = 0 then 'ATIVO' else 'AGUARDANDO_PAGAMENTO' end,
              case when op.preco > 0 then ev.inicio - make_interval(hours => ev.reembolso_ate_horas) end);
      v_total := v_total + op.preco * v_qtd;
    else
      raise exception 'ITEM_INVALIDO';
    end if;
  end loop;

  v_status := case when v_total = 0 then 'PAGO' else 'AGUARDANDO_PAGAMENTO' end;
  update public.appv3_pedidos
     set subtotal = v_total, total = v_total, status = v_status,
         metodo = case when v_total = 0 then 'GRATUITO' else metodo end,
         pix_txid = 'PED' || numero, pago_em = case when v_total = 0 then now() end
   where id = ped.id returning * into ped;
  return to_jsonb(ped);
end $$;

create or replace function public.appv3_informar_pix_pedido(p_pedido uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ped public.appv3_pedidos;
begin
  update public.appv3_pedidos set status = 'AGUARDANDO_CONFERENCIA'
   where id = p_pedido and perfil_id = public.appv3_meu_perfil_id() and status = 'AGUARDANDO_PAGAMENTO' and metodo = 'PIX'
  returning * into ped;
  if ped.id is null then raise exception 'PEDIDO_INVALIDO'; end if;
  return to_jsonb(ped);
end $$;

create or replace function public.appv3_registrar_contribuicao(p_tipo text, p_valor numeric, p_descricao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.appv3_perfis; c public.appv3_contribuicoes; v_tipo text := upper(p_tipo);
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  if v_tipo not in ('DIZIMO','OFERTA') then raise exception 'TIPO_INVALIDO'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000 then raise exception 'VALOR_INVALIDO'; end if;
  insert into public.appv3_contribuicoes (perfil_id, campo_id, church_id, member_id, tipo, valor, descricao, metodo, autenticacao)
  values (p.id, p.campo_id, p.church_id, p.member_id, v_tipo, round(p_valor, 2),
          coalesce(left(nullif(trim(p_descricao), ''), 120),
                   case when v_tipo = 'DIZIMO'
                        then 'Dízimo de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                                                    'setembro','outubro','novembro','dezembro'])[extract(month from now())::int]
                        else 'Oferta voluntária' end),
          'PIX',
          public.appv3_codigo(case when v_tipo = 'DIZIMO' then 'DZ' else 'OF' end))
  returning * into c;
  update public.appv3_contribuicoes set pix_txid = replace(autenticacao, '-', '') where id = c.id returning * into c;
  return to_jsonb(c);
end $$;

create or replace function public.appv3_solicitar_reembolso(p_pedido uuid, p_ingresso uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_perfil uuid := public.appv3_meu_perfil_id(); ped public.appv3_pedidos; ing public.appv3_ingressos; r public.appv3_reembolsos;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
  if p_ingresso is not null then
    select * into ing from public.appv3_ingressos where id = p_ingresso and perfil_id = v_perfil for update;
    if ing.id is null or ing.status <> 'ATIVO' or ing.reembolso_ate is null or ing.reembolso_ate < now() then
      raise exception 'REEMBOLSO_FORA_DO_PRAZO';
    end if;
    update public.appv3_ingressos set status = 'REEMBOLSO_SOLICITADO' where id = ing.id;
    insert into public.appv3_reembolsos (perfil_id, ingresso_id, motivo, valor) values (v_perfil, ing.id, p_motivo, ing.valor_pago)
    returning * into r;
  else
    select * into ped from public.appv3_pedidos where id = p_pedido and perfil_id = v_perfil for update;
    if ped.id is null or ped.status not in ('PAGO','AGUARDANDO_CONFERENCIA','EM_SEPARACAO','ENTREGUE')
       or ped.criado_em < now() - interval '7 days' then
      raise exception 'REEMBOLSO_FORA_DO_PRAZO';
    end if;
    update public.appv3_pedidos set status = 'REEMBOLSO_SOLICITADO' where id = ped.id;
    insert into public.appv3_reembolsos (perfil_id, pedido_id, motivo, valor) values (v_perfil, ped.id, p_motivo, ped.total)
    returning * into r;
  end if;
  return to_jsonb(r);
end $$;

-- -----------------------------------------------------------------------------
-- Cadastro facial nos leitores Control iD (mesma fila do saaschurch)
--
-- Espelha /api/membro/faceid/enroll e /status do saaschurch: a foto fica no
-- bucket `dados` em faceid/enroll/<member_id>/<batch_id>.jpg e cada leitor
-- da igreja recebe um job em face_enrollment_jobs. O agente da rede da igreja
-- (faceid-agent) consome a fila, cadastra no aparelho e, no sucesso, a foto
-- vira members.photo_url. O app não tem service_role; por isso a validação
-- que lá é feita na API aqui é feita nesta função.
-- -----------------------------------------------------------------------------
create or replace function public.appv3_faceid_cadastrar(p_foto text, p_atualizar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.appv3_perfis;
  m public.members;
  v_batch uuid;
  v_prefixo text;
  v_n int;
begin
  select * into p from public.appv3_perfis where auth_user_id = auth.uid();
  if p.id is null then raise exception 'SEM_PERFIL'; end if;
  if p.member_id is null then raise exception 'FACEID_SEM_VINCULO'; end if;
  select * into m from public.members where id = p.member_id;
  if m.rol is null then raise exception 'FACEID_SEM_ROL'; end if;
  if m.church_id is null then raise exception 'FACEID_SEM_IGREJA'; end if;

  -- A foto precisa estar na pasta do próprio membro e já ter sido enviada.
  v_prefixo := 'faceid/enroll/' || m.id::text || '/';
  if p_foto is null or left(p_foto, length(v_prefixo)) <> v_prefixo
     or p_foto !~ '^faceid/enroll/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$' then
    raise exception 'FACEID_FOTO_INVALIDA';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'dados' and o.name = p_foto) then
    raise exception 'FACEID_FOTO_INVALIDA';
  end if;
  v_batch := substring(p_foto from '([0-9a-f-]{36})\.(?:jpg|png)$')::uuid;

  -- Leitores: os da Sede + os da igreja do membro (primária ou secundária),
  -- ativos e com host local, sem repetir.
  insert into public.face_enrollment_jobs (id, batch_id, church_id, device_id, member_id, rol, nome, cpf, photo_url, status, allow_update, updated_at)
  select gen_random_uuid(), v_batch, coalesce(d.church_id, m.church_id), d.id, m.id, m.rol, m.full_name, m.cpf, p_foto, 'pending', coalesce(p_atualizar, false), now()
    from public.faceid_devices d
   where d.is_active and nullif(d.local_host, '') is not null
     and (d.is_sede or d.church_id = m.church_id or d.secondary_church_id = m.church_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'FACEID_SEM_LEITOR'; end if;

  return jsonb_build_object('batch_id', v_batch, 'status', 'pending', 'devices', v_n);
end $$;

-- Andamento de um lote (ou do mais recente): um item por leitor. A agregação
-- e as mensagens dos códigos do Control iD ficam no app (como no saaschurch).
create or replace function public.appv3_faceid_status(p_batch uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_member uuid; v_batch uuid;
begin
  select member_id into v_member from public.appv3_perfis where auth_user_id = auth.uid();
  if v_member is null then return jsonb_build_object('batch_id', null, 'jobs', '[]'::jsonb); end if;
  v_batch := coalesce(p_batch, (select j.batch_id from public.face_enrollment_jobs j where j.member_id = v_member order by j.created_at desc limit 1));
  return jsonb_build_object(
    'batch_id', v_batch,
    'foto_perfil', (select photo_url from public.members where id = v_member),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'status', j.status, 'rol', j.rol, 'error_code', j.error_code, 'error_message', j.error_message,
        'match_user_id', j.match_user_id, 'leitor', coalesce(d.name, 'Leitor')) order by j.created_at)
        from public.face_enrollment_jobs j
        left join public.faceid_devices d on d.id = j.device_id
       where j.member_id = v_member and j.batch_id = v_batch), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- Permissão de execução das funções
-- -----------------------------------------------------------------------------
revoke all on function public.appv3_estrutura_publica() from public;
revoke all on function public.appv3_mundial_publico(uuid) from public;
grant execute on function public.appv3_estrutura_publica() to anon, authenticated;
grant execute on function public.appv3_mundial_publico(uuid) to anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'appv3_criar_perfil(uuid, uuid, uuid, text, text)',
    'appv3_buscar_membro(uuid, text, text, text)',
    'appv3_vincular_membro(uuid, text, text, text)',
    'appv3_meu_cartao()',
    'appv3_minha_igreja()',
    'appv3_diretorio(text, uuid, text)',
    'appv3_perfil_publico(uuid)',
    'appv3_grupos_familiares()',
    'appv3_ministerios()',
    'appv3_ebd_turmas()',
    'appv3_criar_pedido(jsonb, text, int)',
    'appv3_informar_pix_pedido(uuid)',
    'appv3_registrar_contribuicao(text, numeric, text)',
    'appv3_solicitar_reembolso(uuid, uuid, text)',
    'appv3_faceid_cadastrar(text, boolean)',
    'appv3_faceid_status(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- =============================================================================
-- 12. Storage
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('appv3-publico', 'appv3-publico', true), ('appv3-privado', 'appv3-privado', false)
on conflict (id) do nothing;

drop policy if exists appv3_publico_leitura on storage.objects;
create policy appv3_publico_leitura on storage.objects for select to anon, authenticated
  using (bucket_id = 'appv3-publico');
drop policy if exists appv3_publico_escrita on storage.objects;
create policy appv3_publico_escrita on storage.objects for insert to authenticated
  with check (bucket_id = 'appv3-publico' and (storage.foldername(name))[1] = 'perfis'
              and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists appv3_publico_troca on storage.objects;
create policy appv3_publico_troca on storage.objects for update to authenticated
  using (bucket_id = 'appv3-publico' and (storage.foldername(name))[1] = 'perfis'
         and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists appv3_privado_dono on storage.objects;
create policy appv3_privado_dono on storage.objects for all to authenticated
  using (bucket_id = 'appv3-privado' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'appv3-privado' and (storage.foldername(name))[1] = auth.uid()::text);
