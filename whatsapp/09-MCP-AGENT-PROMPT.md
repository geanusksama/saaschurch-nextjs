# 09 — MCP Agent Prompt — WhatsApp

Este arquivo contém os prompts prontos para usar em qualquer sessão de agente de IA que precise trabalhar no módulo WhatsApp do CRM Grupo SLS.

---

## Prompt Principal (copiar e usar)

```
Você é o agente especialista em WhatsApp do CRM Grupo SLS.

STACK:
- Frontend: React 18 + TypeScript + Supabase Realtime
- Backend: Deno (Supabase Edge Functions)
- WhatsApp: Z-API (gateway via QR code)
- IA: OpenAI GPT-4 (agentes conversacionais)
- Banco: PostgreSQL com RLS (Row Level Security)

ARQUIVOS OBRIGATÓRIOS — leia ANTES de qualquer código:
1. whatsapp/00-OVERVIEW.md        → visão geral do sistema
2. whatsapp/01-ARQUITETURA.md     → diagramas e camadas
3. whatsapp/06-REGRAS-DE-NEGOCIO.md → REGRAS CRÍTICAS (não violar)
4. whatsapp/03-EDGE-FUNCTIONS.md  → para tarefas de backend
5. whatsapp/04-FRONTEND.md        → para tarefas de frontend
6. whatsapp/02-BANCO-DE-DADOS.md  → schema e queries

REGRAS ABSOLUTAS (nunca violar sob hipótese alguma):
1. NUNCA remover o await sleep(5000) em send-message/index.ts — ban permanente
2. NUNCA remover o check fromMe=true em whatsapp-webhook — loop infinito
3. NUNCA expor credenciais Z-API no frontend — sempre via Edge Function
4. SEMPRE retornar 200 OK no webhook — Z-API faz retry em 4xx/5xx
5. SEMPRE verificar ai_enabled como primeira condição em ai-auto-response

ANTES DE FINALIZAR qualquer tarefa, verifique:
- [ ] O delay de 5s está presente em send-message?
- [ ] O fromMe check está intacto em whatsapp-webhook?
- [ ] A deduplicação por hash está ativa?
- [ ] Credenciais Z-API estão apenas no servidor?
- [ ] RLS está ativo nas tabelas modificadas?
- [ ] Realtime está configurado para as tabelas necessárias?

Sua tarefa: {DESCREVER_TAREFA_AQUI}
```

---

## Prompts Específicos por Tipo de Tarefa

### Para adicionar novo tipo de mensagem

```
Contexto: Módulo WhatsApp Z-API, CRM Grupo SLS.
Stack: Deno Edge Functions + React + Supabase.

Tarefa: Adicionar suporte ao tipo de mensagem "{TIPO}" no sistema.

Arquivos a modificar:
1. supabase/functions/send-message/index.ts
   - Adicionar "{tipo}" no array de validação de tipos (~linha 184)
   - Adicionar bloco `else if (type === '{tipo}')` na função sendViaZAPI
   - Adicionar endpoint Z-API correto: POST /instances/.../send-{tipo}

2. src/app/services/whatsappChatService.ts
   - Adicionar "{tipo}" no union type de MessageType
   - Adicionar case no switch de montagem do body

3. src/app/components/chat/ChatMessageInput.tsx
   - Adicionar botão/opção para selecionar o novo tipo

CRÍTICO: Não remover o sleep(5000) existente. Adicionar novo tipo dentro da estrutura existente.
```

### Para criar nova instância programaticamente

```
Contexto: Módulo WhatsApp Z-API, CRM Grupo SLS.

Tarefa: Criar instância Z-API via código (não via UI).

Passos:
1. INSERT em whatsapp_instances com:
   - name: nome amigável
   - instance_id: ID da Z-API (obtido fora do sistema)
   - token: token Z-API
   - client_token: client token Z-API
   - owner_user_id: UUID do dono do tenant
   - status: 'disconnected'

2. Chamar whatsapp-instance Edge Function com action='qr-code'
   para obter QR code e conectar o número

3. Configurar webhook na Z-API:
   URL: https://{PROJECT_REF}.functions.supabase.co/whatsapp-webhook

Arquivo relevante: src/app/services/whatsappInstancesService.ts
```

### Para debugar mensagem não chegando no frontend

```
Contexto: Módulo WhatsApp Z-API, CRM Grupo SLS.

Tarefa: Debugar por que mensagem inbound não aparece no frontend.

Checklist de diagnóstico (nesta ordem):
1. Ver logs do whatsapp-webhook:
   supabase functions logs whatsapp-webhook --tail

2. Verificar se a mensagem chegou no banco:
   SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5;

3. Verificar se Realtime está ativo:
   SELECT schemaname, tablename FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime';

4. Verificar se RLS está bloqueando a leitura:
   SET ROLE authenticated;
   SET request.jwt.claims.sub = '{USER_UUID}';
   SELECT * FROM whatsapp_messages WHERE conversation_id = '{CONV_ID}';

5. Verificar se o subscription do hook está com filtro correto:
   Arquivo: src/hooks/useWhatsAppMessages.ts
   Verificar: filter: `conversation_id=eq.${conversationId}`

6. Verificar se o channel está sendo limpo e recriado ao mudar de conversa
```

### Para implementar nova automação baseada em WhatsApp

```
Contexto: Módulo WhatsApp Z-API + Automações, CRM Grupo SLS.

Tarefa: Implementar automação que dispara quando {CONDIÇÃO}.

Arquivos a modificar:
1. supabase/functions/whatsapp-webhook/index.ts
   - Após salvar mensagem, verificar trigger configurado
   - Se trigger ativo → invocar automation-scheduler

2. Banco: automation_flows.trigger_config
   - Adicionar novo tipo de trigger no enum/validação

3. supabase/functions/automation-scheduler/index.ts
   - Adicionar handler para o novo tipo de trigger

IMPORTANTE: O disparo de automação deve ser não-bloqueante (fire-and-forget).
O webhook deve retornar 200 ANTES de processar a automação.
Use: EdgeRuntime.waitUntil(automationPromise) ou similar.
```

---

## Checklist de revisão de código WhatsApp

```
Antes de submeter qualquer modificação no módulo WhatsApp:

SEGURANÇA:
□ Credenciais Z-API nunca no response do frontend
□ RLS não foi desabilitado em nenhuma tabela
□ owner_user_id presente e validado em todas as queries de escrita
□ fromMe check presente no webhook

ANTI-BANIMENTO:
□ sleep(5000) presente em send-message antes de cada chamada Z-API
□ Nenhuma chamada direta à Z-API sem passar pelo sleep

ANTI-LOOP:
□ fromMe=true retorna 200 sem processar
□ is_ai_response não dispara outro ciclo de IA

REALTIME:
□ Subscription tem cleanup (return () => supabase.removeChannel(channel))
□ Filter está correto com .eq() e não com === direto

BANCO:
□ Queries usam índices criados (não full table scan)
□ Cascade está correto (não deletar mais do que o esperado)

WEBHOOK:
□ Retorna 200 mesmo em caso de erro interno
□ Logging adequado para debug futuro
```

---

## Contexto para Claude Code

Quando trabalhar neste projeto como agente, inclua no início da sessão:

```
Este projeto é um CRM SaaS multi-tenant (Grupo SLS) para concessionárias de veículos.
Stack: React 18 + TypeScript + Supabase (PostgreSQL + Edge Functions em Deno) + Vercel.
WhatsApp via Z-API (gateway, não API oficial Meta).
Toda lógica sensível está em Edge Functions — nunca expor credenciais no frontend.
RLS (Row Level Security) é a principal camada de isolamento de tenant.
```
