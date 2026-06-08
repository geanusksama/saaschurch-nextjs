# 05 — Agentes IA no WhatsApp

## O que são

Agentes de IA conversacional que respondem automaticamente mensagens WhatsApp inbound quando `ai_enabled=true` na conversa. Cada agente tem um `system_prompt` personalizado, modelo GPT e temperatura configuráveis.

---

## Tabelas relacionadas

### ai_agents
```sql
CREATE TABLE ai_agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  system_prompt text NOT NULL,
  model         text DEFAULT 'gpt-4',       -- gpt-4 / gpt-3.5-turbo
  temperature   float DEFAULT 0.7,           -- 0.0 = determinístico, 1.0 = criativo
  is_active     boolean DEFAULT true,
  owner_user_id uuid REFERENCES profiles(id),  -- isola por tenant E por vendedor
  created_at    timestamptz DEFAULT now()
);
```

**Isolamento**: `owner_user_id` determina a quem o agente pertence (tenant E vendedor).

### ai_agent_interactions
```sql
CREATE TABLE ai_agent_interactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid REFERENCES ai_agents(id),
  conversation_id uuid,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      float,
  is_test       boolean DEFAULT false,   -- interação de playground vs. produção
  created_at    timestamptz DEFAULT now()
);
```

---

## Páginas de gestão

| Página | Caminho |
|--------|---------|
| Lista de agentes | `src/app/pages/admin/AIAgentsPage.tsx` |
| Criar/Editar agente | `src/app/pages/admin/NewAgentPage.tsx` |
| Playground de teste | `src/app/pages/admin/AgentTestPage.tsx` |
| Analytics de uso | `src/app/pages/admin/AIAnalyticsPage.tsx` |

---

## Fluxo completo de resposta automática

```
1. Mensagem inbound chega via whatsapp-webhook
2. whatsapp-webhook verifica ai_enabled na conversa
3. Se true → invoca ai-auto-response como fire-and-forget
4. ai-auto-response:
   a. Verifica novamente ai_enabled (double-check de segurança)
   b. Aguarda FRAGMENT_WAIT_MS=7000ms (acumula fragmentos)
   c. Verifica deduplicação (janela de 18s)
   d. Resolve qual agente usar (sticky → vendedor → tenant default)
   e. validateAgentScope() → verifica vendor isolation
   f. Busca últimas N mensagens da conversa como histórico
   g. Busca dados do contato (nome, empresa, deals ativos)
   h. Monta prompt: system_prompt + histórico + dados do contato
   i. Chama openai-chat Edge Function
   j. Recebe resposta GPT
   k. Chama send-message para enviar resposta
   l. Atualiza sticky_agent_id nos metadados da conversa
   m. Grava ai_agent_audit_log (non-blocking)
   n. Analisa sentimento → reação automática (opcional)
```

---

## Vendor Isolation (regra crítica)

```
REGRA: Agentes pertencem ao vendedor que os criou (via owner_user_id)

Cenário 1: conversa.assigned_to = NULL
  → Qualquer agente ativo do tenant pode responder
  → Sistema usa o sticky_agent ou o agente default do tenant

Cenário 2: conversa.assigned_to = vendedor_X (uuid)
  → APENAS agentes criados pelo vendedor_X podem responder
  → Agentes criados pelo admin/owner são BLOQUEADOS
  → Razão: cada vendedor tem script/persona própria

Cenário 3: agente pertence a tenant_Y mas conversa é do tenant_X
  → BLOQUEADO (tenant_mismatch)
  → Nunca acontece em operação normal; protege contra bugs

Implementação (validateAgentScope em ai-auto-response/index.ts):
  - Se agent.owner_user_id === conversation.assigned_to → OK
  - Se agent.owner_user_id === tenant_owner_id E assigned_to === NULL → OK
  - Qualquer outro caso → BLOCKED
```

---

## Sticky Agent

```typescript
// Metadados da conversa guardam o último agente bem-sucedido
conversation.metadata.sticky_agent_id = "uuid-do-agente"

// Na próxima mensagem, ai-auto-response tenta esse agente primeiro
// Se o sticky agent foi deletado ou desativado → fallback para agente padrão
```

**Por que sticky?** Garante continuidade de persona — o cliente sempre fala com o "mesmo vendedor virtual" ao longo da conversa.

---

## Agrupamento de Fragmentos

Problema: usuário envia "oi" / "tenho uma dúvida" / "sobre o carro" em 3 mensagens rápidas.

Solução:
```
FRAGMENT_WAIT_MS = 7000       (aguarda 7s antes de processar)
FRAGMENT_GROUP_WINDOW_MS = 18000 (agrupa mensagens dos últimos 18s)

Resultado: as 3 mensagens viram 1 única chamada ao GPT
           evita 3 respostas separadas e contexto fragmentado
```

---

## Deduplicação

```typescript
// Hash da mensagem para evitar processar a mesma mensagem duas vezes
// (pode acontecer se o webhook for chamado mais de uma vez pela Z-API)
const hash = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(message.content)
)

if (conversation.metadata.ai_last_inbound_hash === hashHex &&
    timeSinceLastProcess < FRAGMENT_GROUP_WINDOW_MS) {
  return // já processado, ignora
}
```

---

## Contexto enviado ao GPT

```typescript
const messages = [
  {
    role: 'system',
    content: agent.system_prompt
      + '\n\nInformações do contato: ' + contactContext
  },
  // últimas 20 mensagens da conversa como histórico
  ...conversationHistory.map(msg => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content
  })),
  // mensagem atual
  { role: 'user', content: currentMessage }
]
```

`contactContext` inclui: nome do contato, empresa, deals ativos no CRM.

---

## Audit Log (ai_agent_audit_log)

Toda decisão do agente é logada, independentemente do resultado:

| action | Quando |
|--------|--------|
| `responded` | Agente respondeu com sucesso |
| `blocked` | Vendor isolation bloqueou |
| `skipped` | ai_enabled=false ou deduplicação |
| `error` | Erro na chamada OpenAI ou send-message |

```typescript
// Log é non-blocking — falha no log nunca bloqueia a resposta
try {
  await supabase.from('ai_agent_audit_log').insert({ ... })
} catch (err) {
  console.error('audit log failed (non-blocking):', err)
  // não relança o erro
}
```

---

## Edge Functions relacionadas à IA

| Function | Responsabilidade |
|----------|-----------------|
| `ai-auto-response` | Resposta automática WhatsApp |
| `openai-chat` | Proxy OpenAI (GPT-4/3.5) — usado por ai-auto-response e playground |
| `openai-transcribe` | Whisper — transcrição de áudio inbound |
| `auto-activate-agent` | Ativa agente automaticamente por regra |
| `generate-embedding` | Embeddings vetoriais para busca semântica |

---

## Transcrição de Áudio (Whisper)

```
Mensagem de áudio inbound:
  1. whatsapp-webhook detecta type='audio'
  2. Verifica audioTranscription nas settings_ai do tenant
  3. Se habilitado → invoca openai-transcribe com audio.url
  4. openai-transcribe faz GET na URL do áudio Z-API
  5. Envia para Whisper API
  6. Salva transcrição em whatsapp_messages.metadata.transcription
  7. ai-auto-response usa a transcrição como texto da mensagem
```

---

## Configurar agente para uma conversa

```typescript
// Via whatsappChatService ou direto no banco:
await supabase
  .from('whatsapp_conversations')
  .update({
    ai_enabled: true,
    // O ai-auto-response resolve o agente automaticamente
    // mas é possível forçar via sticky_agent no metadata:
    metadata: { ...conversation.metadata, sticky_agent_id: agentId }
  })
  .eq('id', conversationId)
```
