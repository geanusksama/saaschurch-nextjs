import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { exigirPermissao } from '@/lib/permissoes/servidor'

/**
 * POST /api/whatsapp/messages/bulk-delete
 * Body: { conversationId, ids?: string[], todas?: boolean }
 *
 * Exclusão DEFINITIVA de mensagens de uma conversa — as selecionadas ou todas.
 * Só no sistema: a mensagem continua no WhatsApp de quem recebeu.
 *
 * Dono: master apaga em qualquer conversa; os demais só nas próprias (mesma
 * regra do bulk-delete de conversas). Permissão: a mesma "Excluir" da inbox.
 *
 * "todas" também zera a memória do agente de recepção na conversa
 * (metadata.recepcao_estado): o histórico que ela resumia deixou de existir.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_inbox.whats_app_inbox.excluir')
    if (negado) return negado

    const body = await req.json().catch(() => ({}))
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : ''
    const todas = body?.todas === true
    const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string') : []

    if (!conversationId) return NextResponse.json({ error: 'Conversa não informada.' }, { status: 400 })
    if (!todas && ids.length === 0) return NextResponse.json({ error: 'Nenhuma mensagem selecionada.' }, { status: 400 })

    let convQuery = supabaseAdmin.from('whatsapp_conversations').select('id, metadata').eq('id', conversationId)
    if (user.profileType !== 'master') convQuery = convQuery.eq('owner_user_id', user.id)
    const { data: conv } = await convQuery.maybeSingle()
    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })

    let del = supabaseAdmin.from('whatsapp_messages').delete().eq('conversation_id', conversationId)
    if (!todas) del = del.in('id', ids)
    const { data, error } = await del.select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // a prévia da lista tem que refletir o que sobrou
    const { data: ultima } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('content, type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const meta = { ...((conv.metadata ?? {}) as Record<string, unknown>) }
    if (todas) delete meta.recepcao_estado

    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        last_message: ultima ? (ultima.content || `[${ultima.type}]`) : null,
        last_message_at: ultima?.created_at ?? null,
        ...(todas ? { unread_count: 0, metadata: meta } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    return NextResponse.json({ deleted: data?.length ?? 0 })
  })
}
