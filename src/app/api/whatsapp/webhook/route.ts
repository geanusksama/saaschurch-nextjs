import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ZApiWebhookPayload } from '@/types/whatsapp'

// POST /api/whatsapp/webhook
// Chamado pela Z-API — sem autenticação (IP Z-API)
// REGRA: SEMPRE retornar 200, mesmo em erro (Z-API faz retry em 4xx/5xx)
export async function POST(req: NextRequest) {
  try {
    const payload: ZApiWebhookPayload = await req.json().catch(() => ({}))

    // Ignora mensagens enviadas por nós (previne loop infinito)
    // NUNCA remover esta verificação
    if (payload.fromMe === true) {
      return NextResponse.json({ ok: true })
    }

    if (!payload.instanceId) {
      return NextResponse.json({ ok: true })
    }

    // DeliveryCallback — atualiza status de mensagem outbound
    if (payload.type === 'DeliveryCallback' || payload.type === 'MessageStatusCallback') {
      if (payload.messageId && payload.status) {
        const statusMap: Record<string, string> = {
          SENT: 'sent',
          DELIVERED: 'delivered',
          READ: 'read',
          PLAYED: 'read',
        }
        const mapped = statusMap[payload.status.toUpperCase()] ?? payload.status.toLowerCase()
        await supabaseAdmin
          .from('whatsapp_messages')
          .update({ status: mapped })
          .eq('metadata->>zapi_message_id', payload.messageId)
      }
      return NextResponse.json({ ok: true })
    }

    // Ignora mensagens de grupo (phone termina em @g.us)
    if (payload.phone?.endsWith('@g.us')) {
      return NextResponse.json({ ok: true })
    }

    // Busca instância pelo instance_id Z-API
    const { data: instance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, owner_user_id')
      .eq('instance_id', payload.instanceId)
      .single()

    if (!instance) return NextResponse.json({ ok: true })

    // Normaliza número (remove @s.whatsapp.net e caracteres não numéricos)
    const phone = (payload.phone ?? '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
    if (!phone) return NextResponse.json({ ok: true })

    // Busca ou cria conversa
    const { data: existingConv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, unread_count')
      .eq('instance_id', instance.id)
      .eq('phone', phone)
      .single()

    let conversationId: string
    let currentUnread = 0

    if (existingConv) {
      conversationId = existingConv.id
      currentUnread = existingConv.unread_count ?? 0
    } else {
      const { data: created } = await supabaseAdmin
        .from('whatsapp_conversations')
        .insert({
          instance_id: instance.id,
          phone,
          contact_name: payload.senderName ?? null,
          owner_user_id: instance.owner_user_id,
          status: 'open',
        })
        .select('id')
        .single()

      conversationId = created!.id
    }

    // Determina tipo e conteúdo da mensagem
    let msgType = 'text'
    let content: string | null = null
    let mediaUrl: string | null = null
    let mediaMime: string | null = null

    if (payload.text?.message) {
      msgType = 'text'
      content = payload.text.message
    } else if (payload.image?.url) {
      msgType = 'image'
      content = payload.image.caption ?? null
      mediaUrl = payload.image.url
      mediaMime = payload.image.mimeType ?? 'image/jpeg'
    } else if (payload.document?.url) {
      msgType = 'document'
      content = payload.document.caption ?? payload.document.fileName ?? null
      mediaUrl = payload.document.url
    } else if (payload.audio?.url) {
      msgType = 'audio'
      mediaUrl = payload.audio.url
    } else if (payload.video?.url) {
      msgType = 'video'
      content = payload.video.caption ?? null
      mediaUrl = payload.video.url
    } else if (payload.sticker?.url) {
      msgType = 'sticker'
      mediaUrl = payload.sticker.url
    }

    const messageId = payload.messageId ?? `synthetic_${Date.now()}_${crypto.randomUUID()}`
    const preview = content ?? (msgType !== 'text' ? `[${msgType}]` : '')

    // Salva mensagem inbound
    await supabaseAdmin.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      content: content ?? null,
      type: msgType,
      direction: 'inbound',
      status: 'delivered',
      sender_name: payload.senderName ?? null,
      media_url: mediaUrl ?? null,
      media_mime_type: mediaMime ?? null,
      metadata: { zapi_message_id: messageId },
    })

    // Atualiza conversa
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        last_message: preview,
        last_message_at: new Date().toISOString(),
        unread_count: currentUnread + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

  } catch (err) {
    console.error('[whatsapp/webhook] erro interno', err)
  }

  // SEMPRE retorna 200 (Z-API faz retry em qualquer outro status)
  return NextResponse.json({ ok: true })
}
