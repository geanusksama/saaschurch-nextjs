import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'

/**
 * GET /api/whatsapp/conversations/thread?phone=&instanceId=&limit=
 *
 * A conversa de um telefone, pronta para abrir em modal a partir de qualquer
 * tela que tenha o número na mão (lista do envio em massa, card do pipeline,
 * perfil do membro). Quem chama não conhece o id da conversa — só o telefone.
 *
 * Sem `instanceId`, procura em todas as instâncias que o usuário pode acessar e
 * devolve a conversa com atividade mais recente: é o que a pessoa espera ver ao
 * clicar no ícone de chat, sem ter de escolher número antes.
 *
 * Telefone sem conversa nenhuma não é erro: devolve conversation null e lista
 * vazia, e a tela abre o compositor para a primeira mensagem.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const phone = (sp.get('phone') ?? '').replace(/\D/g, '')
    const instanceId = sp.get('instanceId') ?? ''
    const limit = Math.min(Math.max(1, Number(sp.get('limit')) || 200), 500)

    if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 })

    // instâncias que este usuário pode ver (dono ou autorizado; master vê tudo)
    const accessible = await getAccessibleInstanceIds(String(user.id), user.profileType)
    if (accessible && accessible.size === 0) {
      return NextResponse.json({ conversation: null, messages: [] })
    }
    if (instanceId && accessible && !accessible.has(instanceId)) {
      return NextResponse.json({ error: 'Sem acesso a esta instância.' }, { status: 403 })
    }

    let convQuery = supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, instance_id, phone, contact_name, status, unread_count, last_message, last_message_at, ai_enabled, ai_agent_id')
      .eq('phone', phone)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)

    if (instanceId) convQuery = convQuery.eq('instance_id', instanceId)
    else if (accessible) convQuery = convQuery.in('instance_id', Array.from(accessible))

    const { data: convs, error: convErr } = await convQuery
    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

    const conversation = convs?.[0] ?? null
    if (!conversation) return NextResponse.json({ conversation: null, messages: [] })

    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, content, type, direction, status, sender_name, media_url, media_mime_type, metadata, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

    // abrir a conversa é ler: zera o não-lido, como no WhatsApp
    if ((conversation.unread_count ?? 0) > 0) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
    }

    const { data: instance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, name, phone_number, status')
      .eq('id', conversation.instance_id)
      .maybeSingle()

    return NextResponse.json({
      conversation: { ...conversation, unread_count: 0 },
      instance: instance ?? null,
      messages: messages ?? [],
    })
  })
}
