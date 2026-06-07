import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/whatsapp/messages?conversationId=&limit=50&offset=0
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const conversationId = sp.get('conversationId')
    const limit = Math.min(parseInt(sp.get('limit') ?? '50'), 200)
    const offset = parseInt(sp.get('offset') ?? '0')

    if (!conversationId) return NextResponse.json({ error: 'conversationId é obrigatório' }, { status: 400 })

    // Verifica que a conversa pertence ao usuário
    const { data: conv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('owner_user_id', user.id)
      .single()

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
