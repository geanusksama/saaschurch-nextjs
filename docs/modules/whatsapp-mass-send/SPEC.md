# SPEC — Envio de WhatsApp em Massa (Campanhas)

> Baseado em `docs/emmassa.txt` (wireframe) e integrado à tela **Gestão Pastoral** como nova aba.
> Data: 2026-07-03 · Status: em desenvolvimento (ver `TASKS.md`)

## Objetivo

Permitir localizar **membros** ou **contatos do pipeline pastoral** (pessoas que chegam pelo
home da igreja: "Quero ser Membro", "Visita Pastoral", "Aconselhamento" etc.), selecionar quem
receberá mensagens, escrever mensagem com **variáveis dinâmicas**, escolher **instâncias**
WhatsApp para distribuir o envio, acompanhar o progresso em tempo real e **atribuir agentes**
(atendentes) para responder cada pessoa.

## Onde fica na UI

A rota `pastoral-kanban` passa a renderizar `PastoralHub` com três abas:

| Aba | Componente | Conteúdo |
|---|---|---|
| Pipeline | `PastoralKanban` (existente, intocado) | Kanban de atendimento |
| Envio em Massa | `PastoralMassSend` | Busca, seleção, mensagem, instâncias, resumo/ETA |
| Envios | `PastoralSendHistory` | Histórico de envios, conversas, agente de IA, Smart |

Permissão: chave já existente `whatsapp_campaigns` (grupo Comunicação,
`src/app-ui/system/permissionCatalog.ts`). A chave já estava no catálogo mas
não era consumida em nenhum lugar do código — agora está gated de fato:

| Onde | Verificação | Efeito |
|---|---|---|
| Abas "Envio em Massa" / "Envios" (`PastoralHub.tsx`) | `canView('whatsapp_campaigns')` | perfis sem view só veem a aba Pipeline |
| Botão "Iniciar envio em massa" / mensagem individual (`PastoralMassSend.tsx`) | `canCreate('whatsapp_campaigns')` | desabilitado com tooltip se faltar permissão |
| Atribuir/remover agente de IA, em lote ou por linha (`PastoralSendHistory.tsx`) | `canEdit('whatsapp_campaigns')` | botões de IA desabilitados |
| Reenvio manual / "Enviar sugestão" (Smart) (`PastoralSendHistory.tsx`) | `canCreate('whatsapp_campaigns')` | desabilitado com tooltip |

Como o padrão do projeto é aplicar RBAC apenas no client (as rotas de API só
validam autenticação + escopo de igreja/campo via `withAuth`, não a matriz de
permissões), essas checagens seguem a mesma convenção das demais telas —
nenhuma rota nova ganhou verificação server-side de permissão.

## v2 (2026-07-03) — evoluções

- **Resumo de envio** substitui o console puro: cards Total/Enviadas/Enviando/
  Pendentes/Erros + relógio de **tempo decorrido** e **ETA** (pendentes ×
  intervalo ÷ instâncias conectadas), com a lista de status por destinatário abaixo.
- **Intervalo configurável**: `interval_seconds` da campanha define o cooldown
  por instância do escalonador. **Mínimo 5 s** (forçado no backend — proteção
  contra banimento); configurável para mais na UI.
- **Anexos**: `image_url` (imagem enviada como anexo; a mensagem vira legenda,
  via `send-image` da Z-API) e `link_url` (ex.: vídeo — anexado ao final do texto).
- **Mensagem individual**: ícone de chat na linha do contato abre diálogo que
  envia pela **primeira instância marcada** via `POST /api/whatsapp/send-direct`
  (nunca WhatsApp Web / wa.me). Sem instância marcada → diálogo pede seleção.
  Envio individual usa SEMPRE uma única instância; só o envio em massa distribui.
- **Botão único**: "Iniciar envio em massa (N)" no painel de mensagem (o botão
  duplicado do topo foi removido).
- **Aba Envios** (`GET /api/whatsapp/sends`): cada envio com borda **verde**
  (contato respondeu depois do envio) ou **amarela** (sem resposta). Filtros de
  data, categoria e nome. Clique na linha → drawer com histórico da conversa
  (`GET /api/whatsapp/messages`) + reenvio manual pela instância selecionada.
- **Agente de IA** (não mais selecionado na tela de envio): na aba Envios,
  marcar conversas → botão IA → escolhe um agente de `ai_agents` (Prisma) →
  `POST /api/whatsapp/conversations/assign-ai` seta `ai_agent_id` + `ai_enabled`.
  O **webhook** então responde automaticamente mensagens de texto dessas
  conversas usando o `systemPrompt` do agente (provider openai/anthropic da
  configuração de IA do sistema, via `src/lib/aiReplyService.ts`). Remover IA
  desliga (`ai_enabled=false`).
- **Smart (✨)** por conversa: `POST /api/whatsapp/conversations/[id]/smart`
  gera resumo, quem mais falou, análise e **mensagem sugerida** com botão
  "Enviar sugestão" (envia pela instância selecionada).

## Layout (conforme wireframe imagem 2)

```
┌─────────────────────────────────────────────────────┬──────────────────────┐
│ [data de][data até] [Fonte: Membros|Pipeline]        │  PAINEL DE MENSAGEM  │
│ [Tipo/categoria] [nome/tel/rol...] [Buscar]           │  textarea c/ {{vars}}│
│                                  [Enviar em Massa]    │  chips de variáveis  │
├─────────────────────────────────────────────────────┤  pré-visualização    │
│ ☑ LISTA DE PESSOAS (checkbox, selecionar todos)      │  [Iniciar][Cancelar] │
│   nome · telefone · igreja · tipo · data             ├──────────────────────┤
│   ações rápidas: wa.me / perfil                      │  INSTÂNCIAS          │
│                                                      │  ☑ instância XYZ 🟢  │
│   (durante envio vira CONSOLE DE EXECUÇÃO:           │  ☑ instância ABC 🟢  │
│    João — Enviado 11:20 / Maria — Erro ...)          │  ☐ instância QWE 🔴  │
├─────────────────────────────────────────────────────┴──────────────────────┤
│ ORQUESTRAÇÃO · INTERVALO 5s · TOTAL 3/200 · INST 1: 2/100 · INST 2: 1/100  │
│ [Anexar agente p/ atender todos ▾]  ☑ Agente 1  ☑ Agente 2  (round-robin)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Área de Pesquisa

- **Intervalo de data** — filtra por data de cadastro (membros: `createdAt`; pipeline: `created_at`).
- **Fonte** — `Membros` (tabela `members`) ou `Pipeline` (tabela `pastoral_attendances`).
- **Tipo/categoria** —
  - Fonte Membros: status (ativo/visitante/etc — via filtros do endpoint de members).
  - Fonte Pipeline: `attendance_type` (visita_pastoral, aconselhamento, pedido_oracao,
    emergencial, familiar, casamento, etc — os mesmos tipos dos botões do home) + coluna
    (todo/doing/done/cancelled).
- **Busca textual** — nome, ROL (números), telefone.
- **Botão Buscar** — executa `GET /api/whatsapp/campaigns/contacts`.
- Escopo de igreja/regional respeita o perfil do usuário (mesma regra dos módulos existentes:
  `church` → só a própria igreja; não-master → só o próprio campo).
- Só entram na lista contatos **com telefone** (sem telefone não há envio).

## 2. Lista de Pessoas

Cada linha: checkbox, nome, telefone, igreja, tipo/categoria, data de cadastro.
Seleção individual + "selecionar todos (os filtrados)". Ações rápidas: abrir conversa
`wa.me`, e badge da origem (membro/pipeline).

## 3. Painel de Mensagem

Textarea com suporte a variáveis `{{...}}`. Variáveis disponíveis (chips clicáveis que
inserem no texto):

`{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{igreja}}`, `{{regional}}`, `{{tipo}}`,
`{{rol}}`, `{{cargo}}`, `{{email}}`, `{{data_cadastro}}`, `{{protocolo}}`

- As variáveis são resolvidas **por destinatário** no servidor, a partir do snapshot
  gravado em `whatsapp_campaign_recipients.variables` no momento da criação da campanha.
- Pré-visualização usa o primeiro selecionado.
- Variável inexistente → substituída por string vazia (e destacada em vermelho na prévia).
- **Iniciar** → cria a campanha (`POST /api/whatsapp/campaigns`) já com status `running` e
  dispara o loop de orquestração no cliente.
- **Cancelar** → `PATCH status=cancelled` (pendentes viram `cancelled`). **Pausar/Retomar**
  → `PATCH status=paused|running` sem perder progresso.

## 4. Lista de Instâncias

Todas as instâncias visíveis ao usuário (`useWhatsAppInstances`; master vê todas).
Mostra nome, telefone e status (🟢 connected / 🔴 offline). Só instâncias `connected`
podem ser marcadas.

**Distribuição inteligente (escalonador por cooldown)**: a instância NÃO é pré-atribuída
ao destinatário. A cada envio, o servidor escolhe **em tempo de envio** a instância
marcada que já cumpriu os 5 segundos de espera (a que está livre há mais tempo). Enquanto
uma instância esfria, as outras são usadas — um escalonamento contínuo até acabar a fila.
Com 3 instâncias o ritmo efetivo é ~1 msg/1,7s, mas **cada instância individual nunca
envia com menos de 5s de intervalo**, evitando banimento. No fim, com 1000 mensagens e
3 instâncias o resultado converge para ~334/333/333.

## 5. Console de Execução

Durante uma campanha ativa, a área da lista mostra cada destinatário com status:
`pending` (aguardando) → `sending` → `sent ✅ hh:mm` | `error ❌ motivo`.

## 6. Barra de Status (Orquestração)

Sempre visível durante campanha: `INTERVALO Xs · TOTAL enviadas/total · por instância:
INSTÂNCIA A n/m …` + contagem de erros. Alimentada pela resposta de cada tick.

## 7/8. Agentes (Atendentes)

- Seletor "Anexar agente para atender todos": lista usuários do sistema (`GET /api/users`),
  seleção múltipla.
- Distribuição **round-robin** dos destinatários entre os agentes marcados no momento da
  criação da campanha (`whatsapp_campaign_recipients.agent_user_id`).
- Efeito no envio: a conversa criada/atualizada em `whatsapp_conversations` recebe
  `assigned_to = agent_user_id` — ou seja, quando a pessoa **responder**, a conversa já
  está sob responsabilidade daquele atendente na Caixa de Entrada WhatsApp.

## Modelo de Dados (migration `20260703_whatsapp_mass_campaigns.sql`)

### `whatsapp_campaigns`
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| church_id | uuid null | escopo |
| owner_user_id | text | criador |
| name | text | nome da campanha (auto: "Campanha dd/mm hh:mm") |
| message_template | text | com `{{vars}}` |
| status | text | `draft·running·paused·completed·cancelled` |
| interval_seconds | int default 5 | intervalo de orquestração |
| total_recipients / sent_count / error_count | int | contadores |
| agent_user_ids | text[] | agentes selecionados |
| started_at / finished_at / created_at / updated_at | timestamptz | |

### `whatsapp_campaign_instances`
`campaign_id fk`, `instance_id fk whatsapp_instances`, `assigned_count`, `sent_count`, `error_count`.

### `whatsapp_campaign_recipients`
| coluna | nota |
|---|---|
| campaign_id fk | |
| source | `member` \| `pipeline` |
| source_id | id na tabela de origem |
| name / phone | snapshot |
| variables jsonb | snapshot p/ template |
| instance_id | instância que enviou (definida em tempo de envio pelo escalonador) |
| agent_user_id | agente atribuído (round-robin) |
| status | `pending·sending·sent·error·cancelled` |
| error_message / sent_at | |

## Orquestração de Envio (arquitetura)

Restrições: Z-API exige **≥5s entre envios por instância** (`enforceRateLimit`, nunca
reduzir) e route handlers serverless não podem rodar loop de minutos. Solução: **ticks
orquestrados pelo cliente** (a tela fica aberta acompanhando, como no wireframe):

1. `POST /api/whatsapp/campaigns` cria campanha + recipients (agentes já distribuídos
   round-robin; instância fica em aberto — decidida no envio).
2. Cliente entra em loop: `POST /api/whatsapp/campaigns/[id]/process` → o servidor
   executa **1 envio por tick**, escolhendo a instância marcada cujo cooldown de 5s já
   expirou (a livre há mais tempo — leitura de `whatsapp_instance_rate_limit`). Se
   nenhuma instância está livre, não envia e devolve `waitMs` (quanto falta para a
   próxima liberar).
3. Cliente agenda o próximo tick para `max(300ms, waitMs)` — sem overlap: só agenda
   quando o anterior responde. Com 3 instâncias o escalonador alterna entre elas
   naturalmente (~1 msg/1,7s no total, ≥5s por instância). Página fechada = campanha
   para sozinha; ao reabrir é possível **retomar** (pendentes continuam lá).
4. Último pendente enviado → status `completed` + `finished_at`.

Cada envio também grava em `whatsapp_conversations`/`whatsapp_messages` (histórico
normal da Caixa de Entrada) e aplica `assigned_to` do agente.

## API

| Rota | Método | Função |
|---|---|---|
| `/api/whatsapp/campaigns/contacts` | GET | busca unificada membros+pipeline c/ filtros |
| `/api/whatsapp/campaigns` | GET / POST | listar / criar campanha (+recipients) |
| `/api/whatsapp/campaigns/[id]` | GET / PATCH / DELETE | detalhe+progresso / start·pause·resume·cancel / excluir |
| `/api/whatsapp/campaigns/[id]/process` | POST | tick de envio |

Auth: `withAuth` (Bearer `mrm_token`). Não-master só enxerga as próprias campanhas.

## Arquivos

| Arquivo | Papel |
|---|---|
| `supabase/migrations/20260703_whatsapp_mass_campaigns.sql` | tabelas |
| `src/lib/whatsappCampaignService.ts` | render de template + tick + distribuição |
| `src/app/api/whatsapp/campaigns/**` | rotas acima |
| `src/app-ui/pastoral/PastoralMassSend.tsx` | tela da aba |
| `src/app-ui/pastoral/PastoralHub.tsx` | wrapper com as 2 abas |
| `src/spa/routes.tsx` | rota `pastoral-kanban` → `PastoralHub` |
| `src/components/app-ui-screens/pastoral/*` | cópias espelho (árvore duplicada) |

## Fora de escopo desta fase (backlog)

- Anexos em massa (imagem/PDF/áudio/vídeo) — o service já aceita, UI futura.
- Agendamento de campanhas (data/hora), relatórios de leitura/resposta,
  distribuição por carga (menos atendimentos primeiro), limite por instância configurável.
