# 03 — Edge Functions — WhatsApp

Todas as Edge Functions rodam em **Deno** no Supabase. Deploy via `supabase functions deploy <nome>`.

---

## send-message

**Caminho**: `supabase/functions/send-message/index.ts`
**Método**: POST
**Auth**: `Authorization: Bearer {SUPABASE_ANON_KEY}`

### Finalidade
Proxy seguro para envio de mensagens via Z-API. Mantém credenciais no servidor e implementa rate limiting obrigatório de 5 segundos.

### Input
```typescript
{
  to: string;           // "5511999990001" (DDI + número, sem + ou espaços)
  message: string;      // texto da mensagem
  instanceId: string;   // ID da instância Z-API
  token: string;        // token Z-API
  clientToken: string;  // client token Z-API
  type?: "text" | "image" | "document" | "audio" | "video" | "link";
  mediaUrl?: string;    // URL pública da mídia (para tipos não-text)
  caption?: string;     // legenda da imagem/vídeo
  fileName?: string;    // nome do arquivo (documentos)
  // para "link":
  title?: string;
  linkUrl?: string;
  linkDescription?: string;
  linkImage?: string;
}
```

### Output — sucesso
```json
{ "messageId": "3EB0C5A1B2C3D4E5", "status": "sent" }
```

### Output — erro
```json
{ "error": "instance_not_connected" }
{ "error": "invalid_phone" }
{ "error": "missing_credentials" }
{ "error": "rate_limit_active" }
{ "error": "zapi_error", "details": "mensagem da Z-API" }
```

### Rate limiting (CRÍTICO)
```typescript
// Implementado com sleep ANTES de cada chamada à Z-API
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
await sleep(5000) // NUNCA remover ou reduzir
```

### Endpoints Z-API chamados
```
POST /instances/{instanceId}/token/{token}/send-text
POST /instances/{instanceId}/token/{token}/send-image
POST /instances/{instanceId}/token/{token}/send-audio
POST /instances/{instanceId}/token/{token}/send-video
POST /instances/{instanceId}/token/{token}/send-document/{ext}
POST /instances/{instanceId}/token/{token}/send-link
```

### Headers enviados à Z-API
```
Content-Type: application/json
Client-Token: {clientToken}   ← obrigatório em algumas contas
```

### Erros comuns
| Erro Z-API | Causa | Solução |
|-----------|-------|---------|
| 401 | Token inválido ou expirado | Renovar token na Z-API |
| 404 | Instância não encontrada | Verificar instance_id |
| `DISCONNECTED` | Instância desconectada | Reconectar via QR code |
| `INVALID_PHONE` | Número inválido | Verificar DDI e formato |

---

## whatsapp-webhook

**Caminho**: `supabase/functions/whatsapp-webhook/index.ts`
**Método**: POST
**Auth**: Sem auth (chamado pela Z-API — IP whitelist ou validação por instanceId)

### Finalidade
Recebe todos os eventos da Z-API: mensagens recebidas, status de entrega. Cria/atualiza conversas e dispara IA quando necessário.

### Fluxo de processamento
```
1. Recebe POST da Z-API
2. Valida: instanceId está presente no payload?
3. Busca instância em whatsapp_instances por instance_id
4. type=DeliveryCallback? → atualiza status da mensagem e RETORNA 200
5. fromMe=true? → mensagem enviada por nós, registra e RETORNA 200
6. Normaliza phone: remove caracteres não numéricos
7. Busca conversa: WHERE instance_id=X AND phone=Y AND owner_user_id=Z
8. Não existe? → cria nova conversa com status='open'
9. Salva mensagem em whatsapp_messages (direction='inbound')
10. Atualiza: last_message_at, last_message, unread_count na conversa
11. Cria notificação para assigned_to (ou owner se null)
12. ai_enabled=true na conversa? → invoca ai-auto-response
13. SEMPRE retorna 200 OK (Z-API faz retry se não receber 200)
```

### Payload Z-API (ReceivedCallback)
```typescript
{
  instanceId: string;
  messageId: string;        // pode ser omitido → gera synthetic_
  phone: string;            // "5511999990001@s.whatsapp.net"
  fromMe: boolean;
  type: "ReceivedCallback" | "DeliveryCallback" | "MessageStatusCallback";
  text?: { message: string };
  image?: { url: string; caption?: string; mimeType: string };
  document?: { url: string; fileName: string; caption?: string };
  audio?: { url: string };
  video?: { url: string; caption?: string };
  sticker?: { url: string };
  senderName?: string;
  chatName?: string;        // nome do grupo (para msgs de grupo)
  isGroupMsg?: boolean;
  participant?: string;     // remetente no grupo (sufixo @s.whatsapp.net)
  momment: number;          // timestamp Unix em ms (typo intencional da Z-API)
}
```

### Grupos (sufixo @g.us)
```
chatId termina em @g.us → é mensagem de grupo
phone do contato → extraído do campo `participant`
```

### messageId sintético
Quando Z-API omite `messageId`:
```typescript
const messageId = payload.messageId
  ?? `synthetic_${Date.now()}_${crypto.randomUUID()}`
```

### ARMADILHA: fromMe check
```typescript
// NUNCA remover — previne loop infinito de mensagens
if (payload.fromMe === true) {
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
```

---

## whatsapp-instance

**Caminho**: `supabase/functions/whatsapp-instance/index.ts`
**Método**: POST
**Auth**: `Authorization: Bearer {SUPABASE_ANON_KEY}`

### Finalidade
Proxy seguro para gerenciar lifecycle de instâncias na Z-API.

### Input
```typescript
{
  action: "status" | "qr-code" | "disconnect" | "restart" | "create" | "delete";
  instanceId: string;
  token: string;
  clientToken: string;
}
```

### Output por action

**status**:
```json
{
  "status": "CONNECTED",
  "connected": true,
  "smartphoneConnected": true,
  "phoneNumber": "5511999990001"
}
```

**qr-code**:
```json
{ "qrCode": "data:image/png;base64,iVBORw0KGgo..." }
```

**disconnect**:
```json
{ "success": true }
```

### QR Code polling (frontend)
```typescript
// WhatsAppInstances.tsx — polling a cada 3 segundos
const interval = setInterval(async () => {
  const { data } = await supabase.functions.invoke('whatsapp-instance', {
    body: { action: 'status', instanceId, token, clientToken }
  })
  if (data?.connected) {
    clearInterval(interval)
    setInstanceStatus('connected')
  }
}, 3000)

// IMPORTANTE: limpar o interval para evitar memory leak
return () => clearInterval(interval)
```

---

## ai-auto-response

**Caminho**: `supabase/functions/ai-auto-response/index.ts`
**Método**: POST (invocada internamente por whatsapp-webhook)
**Auth**: Service role (chamada interna)

### Finalidade
Gera e envia resposta automática de IA para mensagens inbound quando `ai_enabled=true`.

### Fluxo interno
```
1. Verifica: ai_enabled=true? (primeira verificação — se false, para tudo)
2. Aguarda FRAGMENT_WAIT_MS (7s) para acumular fragmentos
3. Busca agente: sticky_agent → agente do assigned_to → agente padrão do tenant
4. validateAgentScope(): verifica vendor isolation
5. Chama openai-chat com system_prompt do agente + histórico da conversa
6. Envia resposta via send-message
7. Atualiza sticky_agent_id nos metadados da conversa
8. Grava audit log em ai_agent_audit_log (non-blocking)
```

### Vendor Isolation (validateAgentScope)
```
conversa.assigned_to = NULL     → qualquer agente do tenant pode responder
conversa.assigned_to = vendedor → APENAS agente criado pelo vendedor pode responder
                                  Agentes do admin/owner são BLOQUEADOS
agente de outro tenant          → BLOQUEADO (tenant_mismatch)
```

### Deduplicação
```typescript
const FRAGMENT_GROUP_WINDOW_MS = 18000 // 18 segundos

// Se a última mensagem processada foi há menos de 18s E tem o mesmo hash
// → não processa novamente (evita double-response)
const isDuplicate = (
  lastHash === currentHash &&
  Date.now() - lastProcessedAt < FRAGMENT_GROUP_WINDOW_MS
)
```

### Trace ID
```typescript
// Formato: "aiar_{timestamp}_{uuid_curto}"
const traceId = `aiar_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
```

### Auto-Reações
```typescript
// Após resposta enviada, analisa sentimento para reação automática
const sentiment = analyzeSentiment(userMessage)
// positivo (obrigado, ok, fechado) → sendReaction('👍')
// negativo (reclamação, cancelamento) → sendReaction('😕')
```

---

## auto-activate-agent

**Caminho**: `supabase/functions/auto-activate-agent/index.ts`
**Método**: POST (invocada internamente)

### Finalidade
Ativa automaticamente um agente IA para uma conversa com base em regras configuradas.

### Regras de ativação
- `first_message`: ativa quando é a primeira mensagem de um novo contato
- `keyword`: ativa quando a mensagem contém uma palavra-chave específica
- `business_hours`: ativa apenas fora do horário de atendimento

### Input
```typescript
{
  conversationId: string;
  message: string;
  tenantId: string;
}
```

---

## Deploy de Edge Functions

```bash
# Deploy individual
supabase functions deploy send-message
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-instance
supabase functions deploy ai-auto-response

# Deploy de todas
supabase functions deploy

# Ver logs em tempo real
supabase functions logs send-message --tail
supabase functions logs whatsapp-webhook --tail
```
