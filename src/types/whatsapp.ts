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

export interface ZApiWebhookPayload {
  instanceId: string
  messageId?: string
  phone: string
  fromMe: boolean
  type: string
  text?: { message: string }
  image?: { url: string; caption?: string; mimeType: string }
  document?: { url: string; fileName: string; caption?: string }
  audio?: { url: string }
  video?: { url: string; caption?: string }
  sticker?: { url: string }
  senderName?: string
  chatName?: string
  isGroupMsg?: boolean
  participant?: string
  momment?: number
  status?: string
}

export interface ConversationFilters {
  status?: ConversationStatus
  instanceId?: string
  search?: string
}
