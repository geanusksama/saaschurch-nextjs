-- Pagamentos Asaas (2026-10-15)
--
-- Gateway do App Igreja v3 (Pix com baixa automática, cartão, assinaturas de
-- dízimo/oferta) e gestão no painel (menu Pagamentos). Fecha a pendência D-07
-- do appv3. Documentação: docs/architecture/ASAAS-PAGAMENTOS.md.
--
-- Só tabelas novas (asaas_*). Nada muda nas tabelas existentes: a cobrança
-- aponta para appv3_contribuicoes/appv3_pedidos e o webhook atualiza o status
-- delas. Configuração por campo, com a chave de API criptografada
-- (AES-256-GCM, mesma chave de ambiente do Stripe).
--
-- RLS ligada e sem política: ninguém lê pelo navegador/app. Tudo passa pelas
-- rotas /api (Prisma conecta como postgres e não passa por RLS).
--
-- Idempotente.

create table if not exists public.asaas_configs (
  id                uuid primary key default gen_random_uuid(),
  campo_id          uuid not null references public.campos(id) on delete cascade,
  api_key_enc       text not null,
  api_key_final     varchar(8),
  ambiente          varchar(12) not null default 'production',
  webhook_token_enc text,
  webhook_id        varchar(60),
  conta_nome        varchar(255),
  conta_documento   varchar(20),
  ativo             boolean not null default false,
  pix_ativo         boolean not null default true,
  cartao_ativo      boolean not null default true,
  recorrencia_ativa boolean not null default true,
  max_parcelas      smallint not null default 3,
  ultimo_evento_em  timestamptz,
  created_by        uuid,
  created_at        timestamp(3) not null default current_timestamp,
  updated_at        timestamp(3) not null default current_timestamp,
  deleted_at        timestamp(3)
);
create unique index if not exists asaas_configs_campo_id_key on public.asaas_configs(campo_id);

create table if not exists public.asaas_clientes (
  id                uuid primary key default gen_random_uuid(),
  config_id         uuid not null references public.asaas_configs(id) on delete cascade,
  perfil_id         uuid references public.appv3_perfis(id) on delete set null,
  member_id         uuid references public.members(id) on delete set null,
  asaas_customer_id varchar(40) not null,
  nome              varchar(255) not null,
  cpf_cnpj          varchar(14),
  email             varchar(255),
  celular           varchar(20),
  created_at        timestamp(3) not null default current_timestamp,
  updated_at        timestamp(3) not null default current_timestamp
);
create unique index if not exists asaas_clientes_config_id_asaas_customer_id_key on public.asaas_clientes(config_id, asaas_customer_id);
create index if not exists asaas_clientes_perfil_id_idx on public.asaas_clientes(perfil_id);
create index if not exists asaas_clientes_member_id_idx on public.asaas_clientes(member_id);
create index if not exists asaas_clientes_cpf_cnpj_idx on public.asaas_clientes(config_id, cpf_cnpj);

create table if not exists public.asaas_assinaturas (
  id                    uuid primary key default gen_random_uuid(),
  config_id             uuid not null references public.asaas_configs(id) on delete cascade,
  campo_id              uuid not null references public.campos(id) on delete cascade,
  church_id             uuid references public.churches(id) on delete set null,
  perfil_id             uuid references public.appv3_perfis(id) on delete set null,
  member_id             uuid references public.members(id) on delete set null,
  asaas_subscription_id varchar(40) not null,
  asaas_customer_id     varchar(40),
  tipo                  varchar(10) not null default 'DIZIMO',
  valor                 numeric(12,2) not null,
  ciclo                 varchar(15) not null default 'MONTHLY',
  forma                 varchar(15) not null,
  proximo_vencimento    date,
  status                varchar(15) not null default 'ATIVA',
  descricao             varchar(255),
  cartao_bandeira       varchar(20),
  cartao_final          varchar(4),
  cancelada_em          timestamptz,
  created_at            timestamp(3) not null default current_timestamp,
  updated_at            timestamp(3) not null default current_timestamp
);
create unique index if not exists asaas_assinaturas_asaas_subscription_id_key on public.asaas_assinaturas(asaas_subscription_id);
create index if not exists asaas_assinaturas_campo_id_status_idx on public.asaas_assinaturas(campo_id, status);
create index if not exists asaas_assinaturas_perfil_id_idx on public.asaas_assinaturas(perfil_id);

create table if not exists public.asaas_links (
  id            uuid primary key default gen_random_uuid(),
  config_id     uuid not null references public.asaas_configs(id) on delete cascade,
  campo_id      uuid not null references public.campos(id) on delete cascade,
  asaas_link_id varchar(60) not null,
  nome          varchar(255) not null,
  descricao     varchar(500),
  finalidade    varchar(15) not null default 'OFERTA',
  valor         numeric(12,2),
  forma         varchar(15) not null default 'UNDEFINED',
  tipo_cobranca varchar(15) not null default 'DETACHED',
  max_parcelas  smallint not null default 1,
  ciclo         varchar(15),
  url           text not null,
  ativo         boolean not null default true,
  encerra_em    date,
  criado_por    uuid,
  created_at    timestamp(3) not null default current_timestamp,
  updated_at    timestamp(3) not null default current_timestamp
);
create unique index if not exists asaas_links_asaas_link_id_key on public.asaas_links(asaas_link_id);
create index if not exists asaas_links_campo_id_idx on public.asaas_links(campo_id);

create table if not exists public.asaas_cobrancas (
  id                     uuid primary key default gen_random_uuid(),
  config_id              uuid not null references public.asaas_configs(id) on delete cascade,
  campo_id               uuid not null references public.campos(id) on delete cascade,
  church_id              uuid references public.churches(id) on delete set null,
  perfil_id              uuid references public.appv3_perfis(id) on delete set null,
  member_id              uuid references public.members(id) on delete set null,
  origem                 varchar(15) not null,
  contribuicao_id        uuid references public.appv3_contribuicoes(id) on delete set null,
  pedido_id              uuid references public.appv3_pedidos(id) on delete set null,
  assinatura_id          uuid references public.asaas_assinaturas(id) on delete set null,
  link_id                uuid references public.asaas_links(id) on delete set null,
  asaas_payment_id       varchar(40) not null,
  asaas_installment_id   varchar(40),
  asaas_customer_id      varchar(40),
  forma                  varchar(15) not null,
  status                 varchar(40) not null default 'PENDING',
  valor                  numeric(12,2) not null,
  valor_liquido          numeric(12,2),
  valor_estornado        numeric(12,2) not null default 0,
  parcelas               smallint not null default 1,
  descricao              varchar(255),
  pagador_nome           varchar(255),
  invoice_url            text,
  pix_payload            text,
  pix_expira             timestamptz,
  cartao_bandeira        varchar(20),
  cartao_final           varchar(4),
  vencimento             date,
  pago_em                timestamptz,
  estornado_em           timestamptz,
  criado_por             uuid,
  dados                  jsonb,
  created_at             timestamp(3) not null default current_timestamp,
  updated_at             timestamp(3) not null default current_timestamp
);
create unique index if not exists asaas_cobrancas_asaas_payment_id_key on public.asaas_cobrancas(asaas_payment_id);
create index if not exists asaas_cobrancas_campo_id_created_at_idx on public.asaas_cobrancas(campo_id, created_at);
create index if not exists asaas_cobrancas_status_idx on public.asaas_cobrancas(campo_id, status);
create index if not exists asaas_cobrancas_contribuicao_id_idx on public.asaas_cobrancas(contribuicao_id);
create index if not exists asaas_cobrancas_pedido_id_idx on public.asaas_cobrancas(pedido_id);
create index if not exists asaas_cobrancas_assinatura_id_idx on public.asaas_cobrancas(assinatura_id);
create index if not exists asaas_cobrancas_perfil_id_idx on public.asaas_cobrancas(perfil_id);
create index if not exists asaas_cobrancas_installment_idx on public.asaas_cobrancas(asaas_installment_id);

create table if not exists public.asaas_webhook_eventos (
  id           varchar(80) primary key,
  config_id    uuid references public.asaas_configs(id) on delete set null,
  evento       varchar(60) not null,
  payload      jsonb not null,
  recebido_em  timestamptz not null default now(),
  processado_em timestamptz,
  ignorado     boolean not null default false,
  erro         text
);
create index if not exists asaas_webhook_eventos_config_recebido_idx on public.asaas_webhook_eventos(config_id, recebido_em);

alter table public.asaas_configs enable row level security;
alter table public.asaas_clientes enable row level security;
alter table public.asaas_assinaturas enable row level security;
alter table public.asaas_links enable row level security;
alter table public.asaas_cobrancas enable row level security;
alter table public.asaas_webhook_eventos enable row level security;
