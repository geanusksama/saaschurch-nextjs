# 10 — Skills do Sistema WhatsApp

Referência das skills existentes relacionadas ao módulo WhatsApp.

---

## Skill 01 — Z-API WhatsApp

**Arquivo original**: `skills/01-zapi-whatsapp.md`

### Capacidades
- Enviar mensagens de texto, imagem, áudio, vídeo, documento, link
- Receber mensagens de qualquer tipo
- Disparar respostas automáticas de IA
- Criar e gerenciar instâncias WhatsApp por tenant

### Quando usar
- Qualquer tarefa envolvendo envio ou recebimento de mensagens
- Configuração de nova instância
- Debug de webhook inbound
- Implementação de novo tipo de mensagem

### Restrições críticas
- Rate limit: 5s entre envios (NUNCA remover)
- fromMe check no webhook (NUNCA remover)
- Credenciais Z-API apenas server-side

---

## Skill 02 — OpenAI (Agentes IA)

**Arquivo original**: `skills/02-openai-integration.md`
**Arquivo relacionado**: `skills/03-agentes-ia.md`

### Capacidades relacionadas ao WhatsApp
- Configurar agente com system_prompt personalizado
- Resposta automática em conversas WhatsApp (`ai-auto-response`)
- Transcrição de áudio inbound via Whisper
- Playground para testar agente antes de ativar

### Quando usar
- Ativar/configurar IA em conversas WhatsApp
- Debugar respostas automáticas
- Criar novo agente para tenant
- Analisar custo de tokens por agente

---

## Skill 06 — Supabase Edge Functions

**Arquivo original**: `skills/06-supabase-edge-functions.md`

### Capacidades relacionadas ao WhatsApp
- Deploy de Edge Functions Deno
- Configurar secrets (ZAPI_CLIENT_TOKEN, OPENAI_API_KEY)
- Ver logs em tempo real
- Invocar funções entre si (invoke interno)

### Quando usar
- Deploy de send-message, whatsapp-webhook, whatsapp-instance
- Configurar variáveis de ambiente em produção
- Debug de erros em Edge Functions

### Comandos principais
```bash
supabase functions deploy send-message
supabase functions deploy whatsapp-webhook
supabase functions logs whatsapp-webhook --tail
supabase secrets set ZAPI_CLIENT_TOKEN=xxx
```

---

## Skill 07 — Automações

**Arquivo original**: `skills/07-automacoes.md`

### Capacidades relacionadas ao WhatsApp
- Configurar trigger baseado em mensagem WhatsApp (keyword, first_message)
- Conectar automação ao fluxo de mensagens inbound
- Adicionar nó de "enviar WhatsApp" em fluxo de automação

### Quando usar
- Criar automação que dispara ao receber mensagem com palavra-chave
- Configurar boas-vindas automáticas para primeiro contato
- Integrar WhatsApp com pipeline de CRM via automação

---

## Skill 08 — CRM Kanban

**Arquivo original**: `skills/08-crm-kanban.md`

### Capacidades relacionadas ao WhatsApp
- Enviar WhatsApp direto de um deal (via `WhatsAppCompose.tsx`)
- Ver histórico de mensagens WhatsApp no timeline do deal
- Criar lead automaticamente a partir de conversa WhatsApp

### Quando usar
- Integrar conversa WhatsApp com deal do CRM
- Adicionar atividade de WhatsApp no histórico do deal

---

## Skill 09 — Banco de Dados

**Arquivo original**: `skills/09-banco-de-dados.md`

### Tabelas WhatsApp relevantes
- `whatsapp_instances` — credenciais e config por tenant
- `whatsapp_conversations` — conversas com clientes
- `whatsapp_messages` — histórico de mensagens
- `ai_agent_audit_log` — log forense de agentes
- `ai_agents` — configuração de agentes IA

### Quando usar
- Criar migration para nova coluna no módulo WhatsApp
- Escrever query de diagnóstico
- Adicionar índice de performance

---

## Skill 10 — Permissões e RLS

**Arquivo original**: `skills/10-permissoes-rls.md`

### Regras RLS do WhatsApp
- `whatsapp_instances`: isolamento por `owner_user_id`
- `whatsapp_conversations`: owner OU assigned_to pode ver
- `whatsapp_messages`: via conversa pai (nested RLS)
- `ai_agent_audit_log`: apenas service role (Edge Functions)

### Quando usar
- Adicionar nova política RLS para tabela do módulo
- Debug de "permission denied" em query
- Configurar visibilidade por vendedor

---

## Como usar as skills no contexto de agente

### Exemplo: tarefa de envio de novo tipo de mensagem

```
Skills necessárias:
1. Skill 01 (Z-API WhatsApp) — para entender endpoint Z-API do novo tipo
2. Skill 06 (Edge Functions) — para modificar send-message e fazer deploy
3. Skill 09 (Banco de Dados) — se precisar de nova coluna em whatsapp_messages

Sequência de leitura:
1. skills/01-zapi-whatsapp.md (seção: Tipos de mensagem, Endpoints Z-API)
2. modules/whatsapp-zapi/EDGE_FUNCTIONS.md (seção: send-message)
3. supabase/functions/send-message/index.ts (código real)
```

### Exemplo: debug de IA não respondendo

```
Skills necessárias:
1. Skill 01 (Z-API WhatsApp) — para entender fluxo de recebimento
2. Skill 03 (Agentes IA) — para entender ai-auto-response
3. Skill 10 (RLS) — caso seja problema de permissão

Sequência de diagnóstico:
1. Verificar logs: supabase functions logs whatsapp-webhook --tail
2. Verificar ai_enabled na conversa
3. Verificar vendor isolation (assigned_to vs. agent.owner_user_id)
4. Verificar ai_agent_audit_log para ver razão do bloqueio
```
