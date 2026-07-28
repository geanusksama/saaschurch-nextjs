import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTextViaZApi, ensureConversation, persistOutboundMessage } from '@/lib/whatsappSendService'
import { randomUUID } from 'crypto'
import { publicBaseUrl } from '@/lib/publicUrl'

/**
 * POST /api/membership-requests/[id]/send-form — reenvia o link da ficha.
 *
 * Envia de verdade pela Z-API (não é `wa.me`, que só abre o WhatsApp Web com o
 * texto e depende de alguém apertar enviar). Gera o token se ainda não houver,
 * e registra o envio na timeline do card.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params

    const { data: request } = await supabaseAdmin
      .from('new_member_requests')
      .select('id, name, whatsapp, status, form_token, pipeline_card_id, church_id')
      .eq('id', id)
      .maybeSingle()

    if (!request) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }
    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: 'Esta solicitação já foi avaliada — não faz sentido reenviar a ficha.' },
        { status: 409 }
      )
    }

    // solicitação antiga sem token ganha um agora
    let token = request.form_token
    if (!token) {
      token = randomUUID().replace(/-/g, '')
      await supabaseAdmin
        .from('new_member_requests')
        .update({ form_token: token, form_sent_at: new Date().toISOString() })
        .eq('id', id)
    }

    const formUrl = `${publicBaseUrl()}/membro/formulario/${token}`
    const firstName = String(request.name ?? '').trim().split(/\s+/)[0] || 'irmão(ã)'

    const message =
      `Olá, *${firstName}*! 😊\n\n` +
      `Para seguir com seu pedido de membresia, precisamos que você preencha sua ficha de cadastro ` +
      `e anexe os documentos (RG/CPF e comprovante de endereço).\n\n` +
      `📝 É rapidinho, por aqui:\n${formUrl}\n\n` +
      `Assim que você enviar, nossa secretaria avalia e te responde por aqui mesmo. Deus abençoe!`

    const { data: instance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, name, instance_id, token, client_token, owner_user_id')
      .eq('is_active', true)
      .eq('status', 'connected')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!instance) {
      return NextResponse.json(
        { error: 'Nenhuma instância de WhatsApp conectada — conecte uma para enviar.', formUrl },
        { status: 503 }
      )
    }

    const phone = String(request.whatsapp).replace(/\D/g, '')
    const result = await sendTextViaZApi(instance, phone, message, { delayTyping: 2 })

    if (result.status !== 'sent') {
      return NextResponse.json(
        { error: `Falha no envio: ${result.error ?? 'erro desconhecido'}`, formUrl },
        { status: 502 }
      )
    }

    const conversationId = await ensureConversation(
      instance.id,
      instance.owner_user_id,
      phone,
      request.name ?? undefined
    )
    await persistOutboundMessage(conversationId, message, result.messageId || undefined)

    await supabaseAdmin
      .from('new_member_requests')
      .update({ form_sent_at: new Date().toISOString() })
      .eq('id', id)

    // garante o link também na timeline pública do card
    if (request.pipeline_card_id) {
      await supabaseAdmin.from('pastoral_attendance_timeline').insert({
        attendance_id: request.pipeline_card_id,
        church_id: request.church_id,
        event_type: 'form',
        description: 'Link da ficha de adesão enviado por WhatsApp',
        metadata: { form_url: formUrl, form_token: token },
      })
    }

    return NextResponse.json({ ok: true, formUrl, instance: instance.name })
  })
}
