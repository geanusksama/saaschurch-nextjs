import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ZApiWebhookPayload } from '@/types/whatsapp'
import { parseInbound } from '@/lib/zapiInbound'
import { registrarMensagemRecebida } from '@/lib/whatsappRecebida'

// a resposta do agente roda em after(): precisa de tempo além do 200
export const maxDuration = 60

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
      .select('id, owner_user_id, metadata')
      .eq('instance_id', payload.instanceId)
      .single()

    if (!instance) return NextResponse.json({ ok: true })

    // Normaliza número (remove @s.whatsapp.net e caracteres não numéricos)
    const phone = (payload.phone ?? '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
    if (!phone) return NextResponse.json({ ok: true })

    // Tipo e conteúdo da mensagem — texto, mídia, localização, contato,
    // resposta de botão/lista, reação, enquete. Ver src/lib/zapiInbound.ts.
    const parsed = parseInbound(payload)

    // Conversa, mensagem, prévia, não lidas, recepção por QR e fila do agente:
    // função comum com o número oficial (src/lib/whatsappRecebidaNucleo.ts).
    await registrarMensagemRecebida({
      instancia: instance,
      telefone: phone,
      nomeRemetente: payload.senderName ?? null,
      mensagem: parsed,
      idExterno: payload.messageId ?? `synthetic_${Date.now()}_${crypto.randomUUID()}`,
      chaveId: 'zapi_message_id',
    })

  } catch (err) {
    console.error('[whatsapp/webhook] erro interno', err)
  }

  // SEMPRE retorna 200 (Z-API faz retry em qualquer outro status)
  return NextResponse.json({ ok: true })
}
