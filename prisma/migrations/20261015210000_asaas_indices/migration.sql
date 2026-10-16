-- Índices das listas de Pagamentos (2026-10-15)
--
-- Cada um atende uma consulta real de src/lib/asaas:
-- 1. Visão geral / Financeiro: soma do recebido no período → campo + pago_em.
-- 2. Secretário/tesoureiro restrito à igreja: lista por igreja e data.
-- 3. Links e campanhas: total recebido por link (groupBy link_id) e
--    pagamentos que chegam pelo link no webhook.
-- 4. Detalhe da cobrança: linha do tempo procura os eventos do webhook pelo
--    id do pagamento dentro do JSON (sem índice = varredura da tabela inteira).
-- 5. Cliente do Asaas por perfil do app em cada config (garantirCliente).
-- 6. Recorrências: lista do campo ordenada pela criação.
--
-- Só CREATE INDEX IF NOT EXISTS; nenhum chama função própria (regra do
-- baseline, RELEASE-CHECKLIST §3).

create index if not exists asaas_cobrancas_campo_pago_idx on public.asaas_cobrancas(campo_id, pago_em);
create index if not exists asaas_cobrancas_church_created_idx on public.asaas_cobrancas(church_id, created_at);
create index if not exists asaas_cobrancas_link_id_idx on public.asaas_cobrancas(link_id);
create index if not exists asaas_webhook_eventos_payment_idx on public.asaas_webhook_eventos ((payload -> 'payment' ->> 'id'));
create index if not exists asaas_clientes_config_perfil_idx on public.asaas_clientes(config_id, perfil_id);
create index if not exists asaas_assinaturas_campo_created_idx on public.asaas_assinaturas(campo_id, created_at);
