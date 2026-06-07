import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTextViaZApi, persistOutboundMessage } from '@/lib/whatsappSendService'

const ZAPI_BASE = 'https://api.z-api.io'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// POST /api/whatsapp/send
// Body: { conversationId, content, type?, mediaUrl?, caption?, fileName? }
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { conversationId, content, type = 'text', mediaUrl, caption, fileName, replyToId, replyToContent, replyToSender } = body

    if (!conversationId || (type === 'text' && !content)) {
      return NextResponse.json({ error: 'conversationId e content são obrigatórios' }, { status: 400 })
    }

    // Busca conversa — master acessa qualquer, outros só as próprias
    const convQuery = supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, phone, instance_id')
      .eq('id', conversationId)
    if (user.profileType !== 'master') convQuery.eq('owner_user_id', user.id)
    const { data: conv } = await convQuery.single()

    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    const instQuery = supabaseAdmin
      .from('whatsapp_instances')
      .select('instance_id, token, client_token')
      .eq('id', conv.instance_id)
    if (user.profileType !== 'master') instQuery.eq('owner_user_id', user.id)
    const { data: instance } = await instQuery.single()

    if (!instance) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

    const replyMeta = replyToId ? { reply_to_id: replyToId, reply_to_content: replyToContent ?? null, reply_to_sender: replyToSender ?? null } : {}

    // Salva mensagem como pending antes de enviar
    const { data: pendingMsg } = await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        content: content ?? null,
        type,
        direction: 'outbound',
        status: 'pending',
        media_url: mediaUrl ?? null,
        metadata: replyMeta,
      })
      .select('id')
      .single()

    // Rate limit obrigatório de 5s
    await sleep(5000)

    let zapiResult: { messageId: string; ok: boolean } = { messageId: '', ok: false }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Client-Token': instance.client_token,
      }
      const base = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}`

      if (type === 'text') {
        const res = await fetch(`${base}/send-text`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: conv.phone, message: content }),
        })
        const json = await res.json()
        zapiResult = { messageId: json.messageId ?? json.id ?? '', ok: res.ok }
      } else if (type === 'image' && mediaUrl) {
        const res = await fetch(`${base}/send-image`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: conv.phone, image: mediaUrl, caption: caption ?? '' }),
        })
        const json = await res.json()
        zapiResult = { messageId: json.messageId ?? json.id ?? '', ok: res.ok }
      } else if (type === 'document' && mediaUrl) {
        const ext = (fileName ?? 'arquivo').split('.').pop() ?? 'pdf'
        const res = await fetch(`${base}/send-document/${ext}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: conv.phone, document: mediaUrl, fileName: fileName ?? 'arquivo' }),
        })
        const json = await res.json()
        zapiResult = { messageId: json.messageId ?? json.id ?? '', ok: res.ok }
      } else if (type === 'video' && mediaUrl) {
        const res = await fetch(`${base}/send-video`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: conv.phone, video: mediaUrl, caption: caption ?? '' }),
        })
        const json = await res.json()
        zapiResult = { messageId: json.messageId ?? json.id ?? '', ok: res.ok }
      } else if (type === 'audio' && mediaUrl) {
        const res = await fetch(`${base}/send-audio`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: conv.phone, audio: mediaUrl }),
        })
        const json = await res.json()
        zapiResult = { messageId: json.messageId ?? json.id ?? '', ok: res.ok }
      }
    } catch (err) {
      console.error('[whatsapp/send] zapi error', err)
    }

    const finalStatus = zapiResult.ok ? 'sent' : 'failed'

    // Atualiza mensagem com status e messageId Z-API
    await supabaseAdmin
      .from('whatsapp_messages')
      .update({
        status: finalStatus,
        metadata: zapiResult.messageId ? { zapi_message_id: zapiResult.messageId } : {},
      })
      .eq('id', pendingMsg?.id)

    // Atualiza last_message na conversa
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Rate limit: registra envio
    await supabaseAdmin
      .from('whatsapp_instance_rate_limit')
      .upsert({ instance_id: conv.instance_id, last_sent_at: new Date().toISOString() })

    return NextResponse.json({
      messageId: pendingMsg?.id,
      zapiMessageId: zapiResult.messageId,
      status: finalStatus,
    })
  })
}
