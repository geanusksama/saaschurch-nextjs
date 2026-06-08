# 08 — Integrações — WhatsApp

## Z-API (Integração Principal)

**Tipo**: API REST externa (gateway WhatsApp Business)
**Base URL**: `https://api.z-api.io`
**Docs**: https://developer.z-api.io
**Autenticação**: Instance ID + Token + Client-Token (por instância)

### Como a Z-API funciona
A Z-API gerencia sessões WhatsApp Web. Cada instância mantém a sessão de um número WhatsApp conectado via QR code. A Z-API expõe uma API REST para envio e recebe eventos via webhook.

### Ciclo de vida de uma instância
```
1. Criar instância no dashboard Z-API → recebe instance_id, token, client_token
2. Chamar endpoint de QR code → Z-API gera QR code
3. Escanear QR code com WhatsApp → instância fica CONNECTED
4. Webhook fica ativo → mensagens chegam automaticamente
5. Smartphone desconecta ou perde sinal → instância fica DISCONNECTED
6. Reconectar via QR code → sem criar nova instância
```

### Headers obrigatórios Z-API
```
Content-Type: application/json
Client-Token: {clientToken}    ← obrigatório em algumas contas
```

---

## OpenAI

**Integração**: Indireta — via Edge Functions `openai-chat` e `openai-transcribe`
**Modelos**: GPT-4 (padrão), GPT-3.5-turbo, GPT-4o
**Whisper**: Para transcrição de áudios inbound

### Fluxo OpenAI via WhatsApp
```
whatsapp-webhook
  → ai-auto-response
    → openai-chat (Edge Function)
      → OpenAI API (GPT-4)
    ← resposta texto
  → send-message
    → Z-API
      → WhatsApp do cliente
```

### Contexto enviado ao GPT
```typescript
[
  { role: 'system', content: agent.system_prompt + contactContext },
  { role: 'user', content: 'mensagem histórico 1' },
  { role: 'assistant', content: 'resposta histórico 1' },
  // ... últimas 20 mensagens
  { role: 'user', content: mensagemAtual }
]
```

### API key por tenant
- Tenant sem key própria → usa `OPENAI_API_KEY` master
- Tenant com key → usa a key configurada em `settings_options.openai_api_key`
- Custo contabilizado em `ai_agent_interactions`

---

## Supabase Realtime

**Tipo**: WebSocket via postgres_changes
**Tabelas com Realtime ativo**:
- `whatsapp_messages` (INSERT) — nova mensagem
- `whatsapp_conversations` (INSERT, UPDATE) — nova conversa ou atualização

### Configurar Realtime no Supabase
```sql
-- Habilitar Realtime para as tabelas (feito via dashboard ou migration)
ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_conversations REPLICA IDENTITY FULL;

-- Adicionar ao publication
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
```

### Uso no frontend
```typescript
// Nova mensagem em uma conversa específica
supabase
  .channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'whatsapp_messages',
    filter: `conversation_id=eq.${conversationId}`
  }, handler)
  .subscribe()

// Qualquer atualização de conversa do tenant
supabase
  .channel(`conversations:${tenantId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'whatsapp_conversations',
    filter: `owner_user_id=eq.${userId}`
  }, handler)
  .subscribe()
```

---

## CRM (Contacts, Deals)

### Vínculo conversa → contato
```typescript
// whatsapp_conversations.contact_id → contacts.id
// Um contato pode ter múltiplas conversas (em instâncias diferentes)
// Uma conversa pode existir sem contato no CRM (apenas phone)
```

### WhatsAppCompose.tsx (envio dentro do deal)
```typescript
// Componente embeddable em DealPage.tsx
<WhatsAppCompose
  dealId={deal.id}
  contactPhone={deal.contact.phone}
  onSent={() => refetchActivities()}
/>

// Após envio, registra atividade no deal:
await activitiesService.create({
  deal_id: dealId,
  type: 'whatsapp_sent',
  description: `WhatsApp enviado: "${content.substring(0, 50)}..."`
})
```

---

## Automações (automation_flows)

O `whatsapp-webhook` pode acionar fluxos de automação configurados:

```typescript
// Tipos de trigger no whatsapp-webhook:
switch (trigger.type) {
  case 'keyword':
    // message.includes(trigger.config.keyword)
    break
  case 'first_message':
    // conversa.created_at === message.created_at (primeira mensagem)
    break
  case 'business_hours':
    // hora atual fora do horário configurado
    break
}

// Se trigger ativo → invoca automation-scheduler
await supabase.functions.invoke('automation-scheduler', {
  body: { flowId: trigger.flow_id, conversationId, message }
})
```

---

## Notificações (tabela notifications)

```typescript
// Criada em whatsapp-webhook para cada mensagem inbound
await supabase.from('notifications').insert({
  user_id: conversation.assigned_to ?? conversation.owner_user_id,
  type: 'whatsapp_message',
  title: `Nova mensagem de ${senderName ?? phone}`,
  body: messageContent.substring(0, 100),
  metadata: {
    conversation_id: conversation.id,
    instance_id: instance.id,
    phone: phone
  },
  read: false
})
```

---

## Supabase Auth (autenticação)

- Todas as chamadas do frontend incluem JWT automático via `supabase.functions.invoke`
- Edge Functions validam o token via `supabase.auth.getUser(authHeader)`
- RLS usa `auth.uid()` para filtrar dados do tenant

---

## Fluxo de autenticação Z-API nas Edge Functions

```typescript
// send-message/index.ts — busca credenciais do banco por conversa
const { data: conversation } = await supabase
  .from('whatsapp_conversations')
  .select('*, whatsapp_instances(*)')
  .eq('id', conversationId)
  .single()

const { instance_id, token, client_token } = conversation.whatsapp_instances

// Nunca expõe credenciais ao frontend — apenas usa internamente
const zapiResponse = await fetch(
  `https://api.z-api.io/instances/${instance_id}/token/${token}/send-text`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': client_token
    },
    body: JSON.stringify({ phone: to, message })
  }
)
```
