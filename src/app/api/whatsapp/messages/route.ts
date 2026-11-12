import { NextRequest, NextResponse } from 'next/server'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/whatsapp/messages?conversationId=&limit=50&offset=0
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    // Conversas e números do WhatsApp: só master ou quem tem "Caixa de Entrada
    // WhatsApp" liberada no perfil (Grupos/Permissões). Vale para toda tela que
    // lê conversas por aqui — é o bloqueio pedido pelo dono, não só esconder.
    const negadoWhats = await exigirPermissao(user, 'whatsapp_inbox.view')
    if (negadoWhats) return negadoWhats
    const sp = new URL(req.url).searchParams
    const conversationId = sp.get('conversationId')
    const limit = Math.min(parseInt(sp.get('limit') ?? '50'), 200)
    const offset = parseInt(sp.get('offset') ?? '0')

    if (!conversationId) return NextResponse.json({ error: 'conversationId é obrigatório' }, { status: 400 })

    // Verifica que a conversa pertence ao usuário (master vê todas)
    const convQ = supabaseAdmin.from('whatsapp_conversations').select('id').eq('id', conversationId)
    if (user.profileType !== 'master') convQ.eq('owner_user_id', user.id)
    const { data: conv } = await convQ.single()

    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    const { data, error, count } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ messages: data ?? [], total: count ?? 0, hasMore: (count ?? 0) > offset + limit })
  })
}
