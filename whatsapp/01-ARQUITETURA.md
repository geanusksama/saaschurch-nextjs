# 01 — Arquitetura do Sistema WhatsApp

## Diagrama Completo de Fluxo

### ENVIO de mensagem

```
┌─────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Chat.tsx   │───▶│  whatsappChatService │───▶│   send-message       │
│  ou         │    │  .sendMessage()      │    │   (Edge Function)    │
│ Compose.tsx │    │                      │    │                      │
└─────────────┘    └──────────────────────┘    └──────────┬───────────┘
                                                           │
                                                  await sleep(5000) ← OBRIGATÓRIO
                                                           │
                                               ┌──────────▼───────────┐
                                               │   Z-API REST API     │
                                               │  api.z-api.io        │
                                               └──────────┬───────────┘
                                                           │
                                               ┌──────────▼───────────┐
                                               │  whatsapp_messages   │
                                               │  (direction=outbound)│
                                               └──────────┬───────────┘
                                                           │
                                               Supabase Realtime
                                                           │
                                               ┌──────────▼───────────┐
                                               │  useWhatsAppMessages │
                                               │  hook → Chat.tsx     │
                                               └──────────────────────┘
```

### RECEBIMENTO de mensagem

```
┌──────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│   WhatsApp   │───▶│      Z-API         │───▶│  whatsapp-webhook    │
│   Network    │    │  (POST webhook)    │    │  (Edge Function)     │
└──────────────┘    └────────────────────┘    └──────────┬───────────┘
                                                          │
                                              ┌───────────▼──────────────┐
                                              │  Identifica instância    │
                                              │  Busca/cria conversa     │
                                              │  Salva mensagem inbound  │
                                              │  Atualiza last_message   │
                                              └───────────┬──────────────┘
                                                          │
                                            ┌─────────────▼────────────────┐
                                            │  ai_enabled=true na conversa?│
                                            └──────┬──────────────┬─────────┘
                                                   │ SIM          │ NÃO
                                        ┌──────────▼───┐   ┌──────▼────────────┐
                                        │ ai-auto-     │   │ Supabase Realtime  │
                                        │ response     │   │ → Frontend         │
                                        └──────┬───────┘   └───────────────────┘
                                               │
                                  ┌────────────▼──────────┐
                                  │  validateAgentScope() │
                                  │  (vendor isolation)   │
                                  └────────────┬──────────┘
                                               │ APROVADO
                                  ┌────────────▼──────────┐
                                  │  openai-chat          │
                                  │  (GPT-4)              │
                                  └────────────┬──────────┘
                                               │
                                  ┌────────────▼──────────┐
                                  │  send-message         │
                                  │  (resposta automática)│
                                  └───────────────────────┘
```

---

## Camadas da Arquitetura

### 1. Camada de Apresentação (Frontend — React)

| Componente | Responsabilidade |
|-----------|-----------------|
| `Chat.tsx` | Interface principal: lista conversas, exibe timeline, input de mensagem |
| `WhatsAppInstances.tsx` | CRUD de instâncias, QR code polling, status |
| `CaixaDeEntradaPage.tsx` | Caixa de entrada omnichannel unificada |
| `WhatsAppCompose.tsx` | Composer embedável dentro de um CRM deal |
| `ChatMessageInput.tsx` | Input com suporte a tipos de mídia |

### 2. Camada de Serviço Frontend

| Serviço | Responsabilidade |
|---------|-----------------|
| `whatsappChatService.ts` | Orquestra envio: resolve instância, delega ao send-message |
| `whatsappInstancesService.ts` | CRUD de instâncias com mapeamento DB → UI |
| `whatsappConversationService.ts` | CRUD de conversas (banco) |
| `whatsappMessageService.ts` | CRUD de mensagens (banco) |
| `whatsappService.ts` | Utilitários compartilhados |

### 3. Camada de Hooks (Estado Reativo)

| Hook | Responsabilidade |
|------|-----------------|
| `useWhatsAppConversations` | Lista de conversas + Realtime (INSERT/UPDATE) |
| `useWhatsAppMessages` | Mensagens de uma conversa + Realtime (INSERT) |
| `useWhatsAppInstances` | Lista de instâncias do tenant |

### 4. Camada Edge (Deno / Supabase Functions)

| Edge Function | Responsabilidade |
|--------------|-----------------|
| `send-message` | Proxy para Z-API REST, rate limiting 5s |
| `whatsapp-webhook` | Receptor Z-API, cria/atualiza conversa, salva mensagem, aciona IA |
| `whatsapp-instance` | Lifecycle de instâncias (status, QR, disconnect, restart) |
| `ai-auto-response` | Resposta automática com vendor isolation e audit log |
| `auto-activate-agent` | Ativa agente automaticamente por regra de trigger |

### 5. Camada de Banco (Supabase PostgreSQL)

| Tabela | Função |
|--------|--------|
| `whatsapp_instances` | Credenciais Z-API por tenant |
| `whatsapp_conversations` | Conversas (1 por número+instância) |
| `whatsapp_messages` | Histórico completo de mensagens |
| `whatsapp_instance_rate_limit` | Controle de rate limit por instância |
| `ai_agent_audit_log` | Log forense de ações de agentes IA |
| `ai_agents` | Configuração de agentes (system_prompt, modelo) |

---

## Multi-Tenant / Multi-Instância

```
Tenant A (Empresa X)
├── Instância 1: Vendas    → (11) 9xxxx-0001 | instance_id=inst_abc | token=tok_abc
├── Instância 2: Suporte   → (11) 9xxxx-0002 | instance_id=inst_def | token=tok_def
└── Instância 3: Marketing → (11) 9xxxx-0003 | instance_id=inst_ghi | token=tok_ghi

Tenant B (Empresa Y)
└── Instância 1: Principal → (21) 9xxxx-0001 | instance_id=inst_jkl | token=tok_jkl
```

**Isolamento garantido por**:
- `owner_user_id` em todas as tabelas
- RLS (Row Level Security) no PostgreSQL
- Validação no backend: `send-message` verifica que o `tenant_id` da conversa corresponde ao `tenant_id` da instância

---

## Supabase Realtime (Push → Frontend)

```typescript
// useWhatsAppMessages.ts — exemplo simplificado
supabase
  .channel(`messages:conv:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'whatsapp_messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    addMessage(payload.new as WhatsAppMessage)
  })
  .subscribe()

// useWhatsAppConversations.ts — escuta atualizações de conversa
supabase
  .channel(`conversations:tenant:${tenantId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'whatsapp_conversations',
    filter: `owner_user_id=eq.${userId}`
  }, (payload) => updateConversation(payload.new))
  .subscribe()
```

---

## Rate Limiting (Anti-Banimento)

```typescript
// send-message/index.ts
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ANTES de cada chamada Z-API:
await sleep(5000) // 5 segundos OBRIGATÓRIOS

// Resultado: máximo de 12 mensagens/minuto por instância
```

**Por que 5 segundos?** A Z-API sinaliza risco de banimento do número WhatsApp se mais de ~10-15 mensagens/minuto forem enviadas pela mesma instância. O delay de 5s é o limite seguro estabelecido.

---

## Webhook URL por Instância

Para cada instância Z-API, o webhook deve ser configurado para:

```
URL: https://{PROJECT_REF}.functions.supabase.co/whatsapp-webhook
Método: POST
Eventos: ReceivedCallback, DeliveryCallback
```

A Z-API usa o `instanceId` no payload para identificar qual instância gerou o evento — não há URL única por instância; o `whatsapp-webhook` usa o campo `instanceId` do body para rotear.
