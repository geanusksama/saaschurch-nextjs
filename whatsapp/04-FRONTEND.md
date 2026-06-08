# 04 — Frontend — WhatsApp

## Páginas

### Chat.tsx
**Caminho**: `src/app/pages/admin/Chat.tsx`
**Tamanho**: ~157KB — componente complexo
**Responsabilidade**: Interface principal de chat omnichannel

Funcionalidades:
- Lista de conversas com filtros (status, instância, vendedor, busca)
- Timeline de mensagens com scroll infinito
- Input de mensagem com suporte a múltiplos tipos
- Indicador de status de entrega por mensagem
- Atribuição de conversa a vendedor
- Toggle de IA por conversa (`ai_enabled`)
- Fechar/reabrir conversa
- Contador de não lidas por conversa

Estado gerenciado via:
- `useWhatsAppConversations` — lista de conversas + realtime
- `useWhatsAppMessages` — mensagens da conversa ativa + realtime
- `useWhatsAppInstances` — instâncias disponíveis

Envio de mensagem:
```typescript
// Fluxo interno do Chat.tsx
const handleSend = async (content: string, type: MessageType) => {
  await whatsappChatService.sendMessage(
    selectedConversation.id,
    content,
    type,
    { mediaUrl, caption, fileName }
  )
}
```

---

### WhatsAppInstances.tsx
**Caminho**: `src/app/pages/admin/WhatsAppInstances.tsx`
**Tamanho**: ~45KB

Funcionalidades:
- Listar instâncias do tenant com status visual
- Criar nova instância (preenche instance_id, token, client_token)
- Exibir QR code para conexão (polling a cada 3s)
- Monitorar status: connected/disconnected/qr_code
- Desconectar/reiniciar instância
- Deletar instância (com confirmação — cascade)

---

### CaixaDeEntradaPage.tsx
**Caminho**: `src/app/pages/admin/communication/CaixaDeEntradaPage.tsx`
**Responsabilidade**: Caixa de entrada unificada (WhatsApp + outros canais)

---

## Serviços de Aplicação

### whatsappChatService.ts
**Caminho**: `src/app/services/whatsappChatService.ts`

Funções principais:
```typescript
// Envia mensagem em uma conversa
sendMessage(
  conversationId: string,
  content: string,
  type: 'text' | 'image' | 'document' | 'audio' | 'video',
  options?: { mediaUrl?: string; caption?: string; fileName?: string }
): Promise<void>

// Busca conversas do tenant com filtros
getConversations(
  filters: { status?: string; instanceId?: string; assignedTo?: string; search?: string }
): Promise<WhatsAppConversation[]>

// Cria conversa manual para um número
createConversation(
  phone: string,
  instanceId: string
): Promise<WhatsAppConversation>

// Alterna IA em uma conversa
toggleAI(conversationId: string, enabled: boolean): Promise<void>

// Atribui vendedor à conversa
assignConversation(conversationId: string, userId: string | null): Promise<void>
```

Internamente, `sendMessage`:
1. Busca a conversa no banco
2. Resolve instância associada (`instance_id`, `token`, `client_token`)
3. Chama `supabase.functions.invoke('send-message', { body: {...} })`
4. Salva mensagem no banco (direction='outbound')

---

### whatsappInstancesService.ts
**Caminho**: `src/app/services/whatsappInstancesService.ts`

```typescript
// CRUD de instâncias
getInstances(): Promise<WhatsAppInstance[]>
createInstance(data: CreateInstanceInput): Promise<WhatsAppInstance>
deleteInstance(id: string): Promise<void>
updateInstance(id: string, data: Partial<WhatsAppInstance>): Promise<void>

// Verificar QR code e status via Edge Function
getQRCode(instance: WhatsAppInstance): Promise<string>
getStatus(instance: WhatsAppInstance): Promise<InstanceStatus>
disconnect(instance: WhatsAppInstance): Promise<void>
```

---

## Serviços Core (Acesso Direto ao Banco)

### whatsappConversationService.ts
**Caminho**: `src/services/whatsappConversationService.ts`

```typescript
// Queries diretas ao Supabase
getConversations(tenantId: string, filters?: ConversationFilters)
getConversationById(id: string)
createConversation(data: NewConversation)
updateConversation(id: string, updates: Partial<Conversation>)
closeConversation(id: string)
markAsRead(id: string)
```

### whatsappMessageService.ts
**Caminho**: `src/services/whatsappMessageService.ts`

```typescript
getMessages(conversationId: string, limit?: number, offset?: number)
createMessage(data: NewMessage)
updateMessageStatus(messageId: string, status: MessageStatus)
```

### whatsappInstanceService.ts
**Caminho**: `src/services/whatsappInstanceService.ts`

```typescript
getInstances(userId: string)
getInstanceById(id: string)
getInstanceByZapiId(zapiInstanceId: string)
```

---

## Hooks

### useWhatsAppConversations
**Caminho**: `src/hooks/useWhatsAppConversations.ts`

```typescript
const {
  conversations,    // WhatsAppConversation[]
  isLoading,
  error,
  refetch,
  filters,
  setFilters
} = useWhatsAppConversations()

// Realtime: escuta INSERT e UPDATE em whatsapp_conversations
// Atualiza a lista automaticamente sem refetch manual
```

### useWhatsAppMessages
**Caminho**: `src/hooks/useWhatsAppMessages.ts`

```typescript
const {
  messages,         // WhatsAppMessage[] ordenadas por created_at
  isLoading,
  hasMore,
  loadMore          // paginação infinita
} = useWhatsAppMessages(conversationId)

// Realtime: escuta INSERT em whatsapp_messages para o conversationId
// Appende novas mensagens à lista sem refetch
```

### useWhatsAppInstances
**Caminho**: `src/hooks/useWhatsAppInstances.ts`

```typescript
const {
  instances,        // WhatsAppInstance[]
  isLoading,
  refetch
} = useWhatsAppInstances()
```

---

## Componentes

### ChatMessageInput.tsx
**Caminho**: `src/app/components/chat/ChatMessageInput.tsx`

Suporta:
- Texto com Enter para enviar (Shift+Enter para nova linha)
- Upload de imagem (preview antes de enviar)
- Upload de documento
- Gravação de áudio (Web API)
- Emoji picker

### WhatsAppCompose.tsx
**Caminho**: `src/app/components/crm/WhatsAppCompose.tsx`

Componente embedável dentro de um CRM deal:
- Seleciona instância disponível do tenant
- Digita mensagem
- Envia WhatsApp sem sair da tela do deal
- Registra atividade no deal após envio

---

## Tipos TypeScript

```typescript
// Principais tipos — definidos em src/types/

interface WhatsAppInstance {
  id: string
  name: string
  instance_id: string
  token: string
  client_token: string
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_code'
  phone_number?: string
  is_active: boolean
  owner_user_id: string
  created_at: string
}

interface WhatsAppConversation {
  id: string
  contact_id?: string
  instance_id: string
  phone: string
  status: 'open' | 'closed' | 'pending'
  ai_enabled: boolean
  assigned_to?: string
  owner_user_id: string
  last_message_at?: string
  last_message?: string
  unread_count: number
  metadata: ConversationMetadata
}

interface WhatsAppMessage {
  id: string
  conversation_id: string
  content?: string
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker'
  direction: 'inbound' | 'outbound'
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  sender_name?: string
  media_url?: string
  media_mime_type?: string
  metadata: MessageMetadata
  created_at: string
}
```

---

## Padrões de código importantes

### Chamar Edge Function
```typescript
// Padrão usado em todo o módulo
const { data, error } = await supabase.functions.invoke('send-message', {
  body: {
    to: phone,
    message: content,
    instanceId: instance.instance_id,
    token: instance.token,
    clientToken: instance.client_token,
    type: messageType
  }
})

if (error) throw new Error(`Falha ao enviar: ${error.message}`)
```

### Realtime subscription com cleanup
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'whatsapp_messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      setMessages(prev => [...prev, payload.new as WhatsAppMessage])
    })
    .subscribe()

  // SEMPRE retornar cleanup para evitar memory leak
  return () => { supabase.removeChannel(channel) }
}, [conversationId])
```
