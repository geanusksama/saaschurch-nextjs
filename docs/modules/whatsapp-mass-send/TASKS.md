# TASKS — Envio de WhatsApp em Massa

> Plano de desenvolvimento. Atualizar os checkboxes conforme o progresso.
> Spec completa: [SPEC.md](./SPEC.md)
> Status: **Fases 1–4 concluídas em 2026-07-03** (QA: 22/22 testes de service + rotas auth-gated)

## Fase 1 — Banco de dados
- [x] Migration `supabase/migrations/20260703_whatsapp_mass_campaigns.sql`
  - [x] `whatsapp_campaigns`
  - [x] `whatsapp_campaign_instances`
  - [x] `whatsapp_campaign_recipients`
  - [x] índices (campaign_id+status)
- [x] Migration aplicada no Supabase (via `prisma db execute`, 2026-07-03)
- [x] **BÔNUS/FIX**: `20260703_fix_rate_limit_instance_id.sql` — a coluna
  `whatsapp_instance_rate_limit.instance_id` era `uuid`, mas todo o código grava o
  instance_id TEXTO da Z-API; o upsert falhava silencioso e o rate limit nunca
  persistia (bug pré-existente do módulo WhatsApp). Coluna alterada para `text`.

## Fase 2 — Backend
- [x] `src/lib/whatsappCampaignService.ts`
  - [x] `renderTemplate()` — substituição de `{{variáveis}}`
  - [x] `assignAgentsRoundRobin()` — agentes round-robin na criação
  - [x] `processCampaignTick()` — escalonador: 1 envio/tick pela instância livre
        há mais tempo (cooldown 5 s por instância); `waitMs` orienta o cliente
- [x] `GET /api/whatsapp/campaigns/contacts` — busca membros (Prisma) + pipeline (Supabase)
- [x] `POST /api/whatsapp/campaigns` — cria campanha + recipients (lotes de 500)
- [x] `GET /api/whatsapp/campaigns` — lista campanhas do usuário
- [x] `GET/PATCH/DELETE /api/whatsapp/campaigns/[id]` — detalhe / pause·resume·cancel / delete
- [x] `POST /api/whatsapp/campaigns/[id]/process` — tick

## Fase 3 — Frontend
- [x] `src/app-ui/pastoral/PastoralMassSend.tsx`
  - [x] filtros (data, fonte membros/pipeline, categoria, busca textual)
  - [x] lista com checkboxes + selecionar todos + ação wa.me
  - [x] painel de mensagem c/ chips de variáveis + prévia por destinatário
  - [x] lista de instâncias com status conectada/offline
  - [x] seletor de agentes (painel verde, round-robin)
  - [x] console de execução (status por destinatário em tempo real)
  - [x] barra de orquestração (total, erros, por instância, cooldown)
  - [x] loop de ticks c/ iniciar / pausar / retomar / cancelar + retomada ao reabrir
- [x] `src/app-ui/pastoral/PastoralHub.tsx` — abas Pipeline | Envio em Massa
- [x] `src/spa/routes.tsx` — rota `pastoral-kanban` → `PastoralHub`

## Fase 4 — Sincronização e verificação
- [x] Espelhados `PastoralHub.tsx` e `PastoralMassSend.tsx` em
      `src/components/app-ui-screens/pastoral/` (árvore excluída do tsconfig)
- [x] Typecheck sem erros nos arquivos novos (repo tem erros pré-existentes não relacionados)
- [x] QA de service (script tsx contra o banco, dados descartáveis QA_*): 22/22
  - renderTemplate, round-robin, criação, progresso, tick com erro Z-API,
    cooldown respeitado entre ticks, conclusão automática, paused não processa,
    cascade de recipients
- [x] QA de rotas: 5 endpoints respondem 401 sem token (auth-gated, compilam)

## Fase 5 — v2 (2026-07-03) — concluída
- [x] Migration `20260703_whatsapp_mass_v2.sql` — `image_url`/`link_url` em
      campaigns, `ai_agent_id` em conversations (aplicada)
- [x] Intervalo de orquestração configurável na UI/API — **mínimo 5 s** forçado
      no backend; QA cobre cooldown de 8 s
- [x] Resumo de envio (cards + tempo decorrido + ETA) no lugar do console puro
- [x] Anexos: imagem (send-image com legenda) e link ao final da mensagem
- [x] Botão único "Iniciar envio em massa (N)" (removido o duplicado do topo)
- [x] Mensagem individual pelo ícone de chat (POST `/api/whatsapp/send-direct`,
      usa a 1ª instância marcada; sem instância → pede seleção)
- [x] Aba **Envios** (`PastoralSendHistory.tsx` + GET `/api/whatsapp/sends`):
      verde=respondeu / amarelo=sem resposta, filtros data/categoria/nome,
      drawer com histórico da conversa + reenvio manual
- [x] Agente de IA em lote (POST `/api/whatsapp/conversations/assign-ai`) —
      seleção de conversas + modal de agentes (`ai_agents`); webhook responde
      automaticamente via `src/lib/aiReplyService.ts` (openai/anthropic)
- [x] Smart (✨): POST `/api/whatsapp/conversations/[id]/smart` — resumo, quem
      mais falou, análise e mensagem sugerida com botão "Enviar sugestão"
- [x] Removido painel de agentes humanos da tela de envio (IA fica na aba Envios)
- [x] Espelho atualizado em `src/components/app-ui-screens/pastoral/`
- [x] QA: 26/26 no service (inclui intervalo 8s) + 4 novas rotas auth-gated (401)

## Fase 6 — Permissões (2026-07-03) — concluída
- [x] Auditoria: a chave `whatsapp_campaigns` já existia no permissionCatalog
      (grupo Comunicação) mas não era consumida em nenhum componente — o
      módulo inteiro ficava acessível a qualquer perfil que chegasse na aba
      Gestão Pastoral (gated só por `pastoral_visits`)
- [x] `PastoralHub.tsx`: abas "Envio em Massa"/"Envios" só aparecem com
      `canView('whatsapp_campaigns')`; volta pro Pipeline se perder acesso
- [x] `PastoralMassSend.tsx`: iniciar campanha e mensagem individual exigem
      `canCreate('whatsapp_campaigns')`
- [x] `PastoralSendHistory.tsx`: atribuir/remover IA (lote, individual, drawer)
      exige `canEdit('whatsapp_campaigns')`; reenvio manual e "Enviar
      sugestão" do Smart exigem `canCreate('whatsapp_campaigns')`
- [x] Confirmado: nenhuma API route do projeto valida a matriz de permissões
      server-side (só `withAuth` + escopo de igreja/campo) — mantido o mesmo
      padrão, sem checagem server-side nova
- [x] Espelhado e typecheck limpo

## Pendências manuais
- [ ] Teste ponta a ponta com instância Z-API real conectada (envio de verdade)
- [ ] Conferir permissão `whatsapp_campaigns` no papel dos usuários que usarão a tela

## Backlog (fases futuras)
- [ ] Anexos em massa (imagem/PDF/áudio/vídeo)
- [ ] Agendamento de campanhas (data/hora)
- [ ] Relatórios (entrega, resposta, falha) por campanha
- [ ] Distribuição de agentes por carga (menos atendimentos primeiro)
- [ ] Limite de mensagens configurável por instância
- [ ] Retomada automática de campanha via cron (sem depender da tela aberta)
