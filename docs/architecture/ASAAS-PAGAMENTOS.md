# Pagamentos Asaas

Gateway do App Igreja v3 (Pix com baixa automática, cartão, dízimo/oferta
recorrente) e menu **Pagamentos** do painel. Entrou em 2026-10-15; fecha a
pendência D-07 do appv3 (`appv3/docs/08-DECISOES.md` D-25).

## Plano de encaixe (o que já existia e o que entrou)

| Papel | Tabela | Como |
| --- | --- | --- |
| Quem paga | `appv3_perfis` + `members` | CPF, e-mail, celular, CEP e nº vêm do membro vinculado; o app pede só o que faltar. Cliente Asaas guardado em `asaas_clientes` |
| O que se paga | `appv3_contribuicoes`, `appv3_pedidos` | Criados pelas RPCs de sempre (`appv3_registrar_contribuicao`, `appv3_criar_pedido`); a cobrança aponta para eles |
| O que é liberado | contribuição `CONFIRMADA`; pedido `PAGO` + ingressos `ATIVO` | `aplicarNoApp` (src/lib/asaas/servico.ts); os gatilhos do app avisam a pessoa |
| Novas | `asaas_configs`, `asaas_clientes`, `asaas_cobrancas`, `asaas_assinaturas`, `asaas_links`, `asaas_webhook_eventos` | Migration `20261015120000_asaas_pagamentos`, baseline `4aedde4892a5816f`. RLS ligada sem política: só a API lê |

Nada mudou nas tabelas existentes. O Stripe (`stripe_*`, app antigo) continua
como estava.

## Configuração por campo

- **Sistema › Configurações › Integrações › Pagamentos Asaas**
  (`/app-ui/system/pagamentos-asaas`): cola a chave (`$aact_prod_…` ou `$aact_hmlg_…`).
  O servidor valida com `GET /myAccount`, guarda **criptografada**
  (AES-256-GCM; chave `ASAAS_ENCRYPTION_KEY` ou derivada da
  `SUPABASE_SERVICE_ROLE_KEY`) e só mostra os 6 últimos caracteres.
- O ambiente sai do prefixo da chave. Nenhuma chave em `.env`, código ou app.
- Ligar/desligar Pix, cartão, recorrência e parcelas máximas (loja: até 3,
  limite de `appv3_criar_pedido`).
- **Master: "Campos que vão usar esta chave"** — caixas de marcar junto da
  chave. Salvar copia a chave e o webhook para os campos marcados; os que
  usavam esta conta e foram desmarcados são desligados; campo com outra conta
  só é trocado se for marcado (o painel confirma). Cada campo continua vendo só as próprias
  cobranças (isolamento por campo); saldo e extrato são da conta inteira e a
  tela avisa quando a conta é compartilhada.
- Webhook: botão "Registrar automaticamente" cria/atualiza o webhook no Asaas
  com a URL do domínio em uso (`/api/asaas/webhook`) e um token aleatório
  (guardado criptografado, o mesmo para todas as configs da mesma conta).

Sem config ativa o app continua exatamente como antes: Pix por BR Code com
"Já paguei" e conferência da tesouraria (D-08).

## Rotas

| Rota | Quem | O quê |
| --- | --- | --- |
| `POST /api/asaas/webhook` | Asaas | token em `asaas-access-token`; idempotente pelo id do evento; erro fica no evento (reprocessável) e responde 200 |
| `/api/appv3/pagamentos/*` | App (JWT da instância) | `config`, `contribuicao`, `pedido`, `cobranca/:id` (consulta o Asaas se pendente), `assinatura(s)` e ações |
| `/api/asaas/admin/*` | Painel | resumo, cobranças, cobrança rápida, estorno/cancelamento, recorrências, links, financeiro, configuração |

A rota do app **não usa `withAuth`** de propósito: ele cria `users` "pending"
para todo login, e membro do app não é usuário do painel.

Telas: uma página por item do menu Pagamentos (sem abas). Permissões
(Funções e Permissões), uma por tela, conferidas também na API:

| Tela | Chave | Ações |
| --- | --- | --- |
| Visão geral `/app-ui/pagamentos` | `asaas_visao` | ver |
| Cobrança rápida `/pagamentos/cobrar` | `asaas_cobrar` | ver; criar = cobrar, recebido em dinheiro, cancelar a que gerou |
| Contribuições e vendas `/pagamentos/vendas` | `asaas_vendas` | ver; criar = recebido em dinheiro; excluir = estornar/cancelar |
| Recorrências `/pagamentos/recorrencias` | `asaas_recorrencias` | ver; editar = pausar/retomar/valor; excluir = cancelar |
| Links e campanhas `/pagamentos/links` | `asaas_links` | ver, criar, editar |
| Financeiro `/pagamentos/financeiro` | `asaas_financeiro` | ver (padrão: master/admin) |
| Configuração `/system/pagamentos-asaas` | `asaas_config` | ver/editar (padrão: master/admin) |
 Secretário/tesoureiro restrito à igreja vê só a igreja dele e
não vê o financeiro da conta.

## Regras

- Pagamento só é confirmado pelo Asaas (webhook, ou `GET /payments/{id}` feito
  pelo servidor no polling da tela). O app nunca marca nada como pago.
- `externalReference` = `sc:<tipo>:<id>`. O webhook processa só o que é deste
  sistema (cobrança registrada, assinatura, parcelamento ou link nossos);
  evento de outro sistema da mesma conta fica como "ignorado".
- Cartão: os dados vão do app → servidor → Asaas na mesma requisição; nada é
  gravado. Fica bandeira, final e o `creditCardToken` (em `appv3_cartoes`,
  `gateway='ASAAS'`) **só se a conta tiver tokenização liberada** — em
  produção o Asaas exige habilitação.
- Cartão recusado: contribuição vira `RECUSADA`; pedido é `CANCELADO` e devolve
  as vagas dos ingressos. A nova tentativa cria outro registro.
- Pix avulso que vence sem pagamento: contribuição `CANCELADA`, pedido
  `CANCELADO` (vagas devolvidas).
- Recorrência (assinatura, ciclo mensal): no cartão debita sozinha; no Pix o
  Asaas gera uma cobrança por mês e o app avisa no sino (o Asaas fica com
  `notificationDisabled`, para não mandar e-mail/SMS em dobro — SMS é cobrado).
  Cada mensalidade vira uma `appv3_contribuicoes` (com autenticação própria).
  Atraso não bloqueia nada: só marca "em aberto".
- **Pix Automático** não está disponível na conta de teste (API responde 403
  "fale com o gerente de contas"). Quando o Asaas liberar, entra como
  terceira forma de recorrência.
- Saque pelo painel não foi feito: a chave deve ser gerada **sem** permissão
  de transferência; saque é pelo app/site do Asaas.

## Testar

1. Configurações: colar a chave, Testar conexão (mostra titular, saldo e
   chaves Pix), ligar "Pagamento online ativo", Registrar webhook.
2. App: Dízimo → Pix → pagar R$ 5,00 pelo banco → a tela fecha sozinha e
   abre o comprovante; a contribuição aparece `CONFIRMADA` e em Pagamentos ›
   Contribuições e vendas.
3. Pagamentos › Contribuições e vendas → abrir → Estornar (valida o estorno).
4. App: Dízimo → Cartão → "Repetir todo mês" → aparece no topo do Histórico
   e em Pagamentos › Recorrências; cancelar pelo app ou pelo painel.
5. Cobrança rápida: R$ 5,00 em Pix para um membro → a tela vira PAGO sozinha.

Em produção cada teste paga taxa do Asaas: use valores baixos e estorne.

## Site, Peniel, campanhas e assistente (2026-10-16)

- **Site público:** menu do topo só em texto (Eventos · Compras · Peniel · CIBE),
  na home e nas páginas novas. `/eventos` (filtro `?dep=<ministério>`; "CIBE"
  = `?dep=cibe`) e `/loja`, no desenho da página do Peniel. Mesmas tabelas do
  app (`appv3_eventos`, `appv3_produtos`); o pedido do site tem `origem = SITE`,
  comprador (nome, CPF, celular, e-mail) e `perfil_id` nulo. Preço e vagas
  relidos do banco; Pix na tela ou cartão na página do Asaas; ingresso com QR
  quando o Asaas confirma. Falha ao cobrar devolve as vagas.
  Rotas: `/api/public/pagamentos/*` (src/lib/asaas/vitrine.ts).
- **Home clássica:** os cards viraram grade de ícones de app; tocar expande
  o cartão com a descrição e a ação. O card do Peniel saiu da grade (está no menu).
- **Peniel:** com Asaas no campo do evento, a inscrição paga por Pix/cartão
  (`asaas_cobrancas.peniel_inscricao_id`); pago → `payment_status = pago` e
  ingresso pelo WhatsApp. Sem comprovante nem data de promessa. Sem Asaas,
  fluxo antigo.
- **Evento e produto com departamento** (`ministerio_id` → `ministries`),
  obrigatório no evento. Criação também em Pagamentos › Eventos e loja.
- **Links:** Campanha exige site de departamento; Evento exige o evento.
- **Assistente "Configurar"** em Configurações: dados da instituição + chave da
  conta própria → valida, confere aprovação e CNPJ, chave Pix, salva, liga as
  formas, registra o webhook (recusado em localhost) e mostra o checklist.
- Migrations `20261015210000_asaas_indices` e
  `20261016090000_pagamentos_site_peniel` (aplicadas no banco de referência em
  2026-10-16 com autorização). **Baseline ainda não regerado**: regerar antes
  do merge (e copiar a remoção do NOT NULL de `appv3_pedidos.perfil_id` e
  `appv3_ingressos.perfil_id` para `baseline/98_patches.sql`).

## Nenhum pagamento manual (2026-10-16)

Pedido do dono: todo recebimento é pelo Asaas.
- **Sites de departamento** (`/dep/<slug>`): loja e inscrição em evento pagam
  por Pix/cartão (`POST /api/public/pagamentos/dept/pagar`, identificação
  id + lookup_token). A cobrança leva `sc:dept-pedido:<id>` /
  `sc:dept-inscricao:<id>` e a confirmação grava `payment_status = PAGO` e
  `payment_ref` (sem coluna nova). Aparecem em Contribuições e vendas como
  "Site de departamento". O link de pagamento colado saiu do site e do
  cadastro de produto.
- **Peniel:** sem link "TON/outro", sem comprovante e sem data de promessa.
  Campo sem Asaas: a ficha é aceita e o pagamento fica para quando o campo ligar
  o Asaas (aparece "Pagar agora" na consulta).
- **App:** sem BR Code estático nem "Já paguei"; campo sem Asaas mostra
  "Pagamento online indisponível" (reserva gratuita continua).
- `/cibe-tickets` e "Comprar Ingresso" do painel (preços fixos no código, não
  cobravam) redirecionam para `/eventos?dep=cibe` e Pagamentos › Eventos e loja.
- Contabilidade (contas a pagar, credores, recibos do caixa) não é recebimento
  online e continua como estava.
