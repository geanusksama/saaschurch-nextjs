export type InstanceStatus = 'connected' | 'disconnected' | 'connecting' | 'qr_code'
export type ConversationStatus = 'open' | 'closed' | 'pending'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'link'

export interface WhatsAppInstance {
  id: string
  name: string
  instance_id: string
  token: string
  client_token: string
  status: InstanceStatus
  phone_number?: string
  is_active: boolean
  owner_user_id: string
  webhook_url?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WhatsAppConversation {
  id: string
  instance_id: string
  phone: string
  contact_name?: string
  status: ConversationStatus
  ai_enabled: boolean
  assigned_to?: string
  owner_user_id: string
  last_message_at?: string
  last_message?: string
  unread_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  instance?: Pick<WhatsAppInstance, 'id' | 'name' | 'phone_number'>
}

export interface WhatsAppMessage {
  id: string
  conversation_id: string
  content?: string
  type: MessageType
  direction: MessageDirection
  status: MessageStatus
  sender_name?: string
  media_url?: string
  media_mime_type?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SendMessagePayload {
  to: string
  message: string
  instanceId: string
  token: string
  clientToken: string
  type?: MessageType
  mediaUrl?: string
  caption?: string
  fileName?: string
  title?: string
  linkUrl?: string
  linkDescription?: string
  linkImage?: string
}

export interface SendMessageResult {
  messageId: string
  status: 'sent' | 'error'
  error?: string
}

/**
 * Corpo do webhook de mensagem recebida da Z-API.
 *
 * Cada mídia tem o campo de URL com o nome do próprio tipo (`imageUrl`,
 * `documentUrl`, `videoUrl`, `stickerUrl`, `audioUrl`) — `url` aparece em
 * payloads antigos e por isso continua declarado como opcional. A leitura
 * fica em src/lib/zapiInbound.ts, que aceita as duas grafias.
 *
 * Referência: https://developer.z-api.io/webhooks/on-message-received-examples
 */
export interface ZApiWebhookPayload {
  instanceId: string
  messageId?: string
  phone: string
  fromMe: boolean
  type: string
  text?: { message: string; url?: string; title?: string; description?: string; thumbnailUrl?: string }
  image?: {
    imageUrl?: string
    url?: string
    caption?: string
    mimeType?: string
    thumbnailUrl?: string
    width?: number
    height?: number
    viewOnce?: boolean
  }
  document?: {
    documentUrl?: string
    url?: string
    fileName?: string
    title?: string
    caption?: string
    mimeType?: string
    pageCount?: number
  }
  audio?: { audioUrl?: string; url?: string; mimeType?: string; ptt?: boolean; seconds?: number }
  /** payloads antigos entregavam a mensagem de voz fora de `audio` */
  ptt?: { audioUrl?: string; url?: string; mimeType?: string }
  video?: { videoUrl?: string; url?: string; caption?: string; mimeType?: string; seconds?: number }
  sticker?: { stickerUrl?: string; url?: string; mimeType?: string }
  location?: { latitude?: number; longitude?: number; address?: string; url?: string }
  contact?: { displayName?: string; vCard?: string; phones?: string[] }
  buttonsResponseMessage?: { buttonId?: string; message?: string }
  listResponseMessage?: { title?: string; message?: string; selectedRowId?: string }
  reaction?: {
    value?: string
    time?: number
    reactionBy?: string
    referencedMessage?: { messageId?: string; fromMe?: boolean; phone?: string; participant?: string }
  }
  poll?: { question?: string; pollMaxOptions?: number; options?: Array<{ name?: string }> }
  pollVote?: { pollMessageId?: string; options?: Array<{ name?: string }> }
  /** id da mensagem citada, quando é resposta */
  referenceMessageId?: string
  forwarded?: boolean
  isEdit?: boolean
  senderName?: string
  senderPhoto?: string
  chatName?: string
  isGroup?: boolean
  isGroupMsg?: boolean
  participant?: string
  participantPhone?: string
  connectedPhone?: string
  momment?: number
  status?: string
}

export interface ConversationFilters {
  status?: ConversationStatus
  instanceId?: string
  search?: string
}
