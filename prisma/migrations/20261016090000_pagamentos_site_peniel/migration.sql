-- Pagamentos em todas as telas: site (Eventos/Compras), Peniel e campanhas (2026-10-16)
--
-- 1. Evento e produto do app ganham o ministério (departamento) responsável:
--    os sites de departamento (department_sites.department_id) já apontam
--    para ministries — Missões, Varões etc.
-- 2. Pedido feito pelo site, sem conta no app: comprador identificado por nome,
--    CPF, celular e e-mail; perfil_id passa a aceitar nulo (o app continua
--    vendo só os pedidos do próprio perfil pela RLS; o alerta do app ignora
--    pedido sem perfil). A remoção do NOT NULL vai também em 98_patches.sql,
--    porque o baseline não afrouxa coluna que já existe nas igrejas.
-- 3. Cobrança Asaas ligada à inscrição do Peniel (pagamento automático no
--    lugar do comprovante) e link de campanha ligado ao site de departamento
--    e ao evento.
--
-- Aditiva e idempotente. Nenhum default/índice chama função própria.

-- 1. Ministério do evento e do produto
alter table public.appv3_eventos add column if not exists ministerio_id uuid;
alter table public.appv3_produtos add column if not exists ministerio_id uuid;
do $$ begin
  alter table public.appv3_eventos add constraint appv3_eventos_ministerio_id_fkey foreign key (ministerio_id) references public.ministries(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.appv3_produtos add constraint appv3_produtos_ministerio_id_fkey foreign key (ministerio_id) references public.ministries(id) on delete set null;
exception when duplicate_object then null; end $$;
create index if not exists appv3_eventos_ministerio_idx on public.appv3_eventos(ministerio_id);
create index if not exists appv3_produtos_ministerio_idx on public.appv3_produtos(ministerio_id);

-- 2. Comprador do site
alter table public.appv3_pedidos add column if not exists origem varchar(10) not null default 'APP';
alter table public.appv3_pedidos add column if not exists comprador_nome varchar(255);
alter table public.appv3_pedidos add column if not exists comprador_cpf varchar(14);
alter table public.appv3_pedidos add column if not exists comprador_celular varchar(20);
alter table public.appv3_pedidos add column if not exists comprador_email varchar(255);
alter table public.appv3_pedidos alter column perfil_id drop not null;
alter table public.appv3_ingressos alter column perfil_id drop not null;
create index if not exists appv3_pedidos_origem_idx on public.appv3_pedidos(campo_id, origem, criado_em);

-- 3. Peniel, campanha e evento na cobrança/link
alter table public.asaas_cobrancas add column if not exists peniel_inscricao_id uuid;
do $$ begin
  alter table public.asaas_cobrancas add constraint asaas_cobrancas_peniel_inscricao_id_fkey foreign key (peniel_inscricao_id) references public.peniel_registrations(id) on delete set null;
exception when duplicate_object then null; end $$;
create index if not exists asaas_cobrancas_peniel_idx on public.asaas_cobrancas(peniel_inscricao_id);

alter table public.asaas_links add column if not exists department_site_id uuid;
alter table public.asaas_links add column if not exists evento_id uuid;
do $$ begin
  alter table public.asaas_links add constraint asaas_links_department_site_id_fkey foreign key (department_site_id) references public.department_sites(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.asaas_links add constraint asaas_links_evento_id_fkey foreign key (evento_id) references public.appv3_eventos(id) on delete set null;
exception when duplicate_object then null; end $$;
create index if not exists asaas_links_department_site_idx on public.asaas_links(department_site_id);
create index if not exists asaas_links_evento_idx on public.asaas_links(evento_id);
