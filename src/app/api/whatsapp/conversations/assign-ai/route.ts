import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST /api/whatsapp/conversations/assign-ai
// Marca/desmarca agente de IA em lote.
// Body: { conversationIds: string[], agentId: string | null }
//  - agentId presente → conversas passam a ser atendidas pelo agente (ai_enabled=true)
//  - agentId null → IA desligada nas conversas (ai_enabled=false, ai_agent_id=null)
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { conversationIds, agentId } = body as {
      conversationIds?: string[]
      agentId?: string | null
    }

    if (!Array.isArray(conversationIds) || !conversationIds.length) {
      return NextResponse.json({ error: 'Selecione ao menos uma conversa' }, { status: 400 })
    }

    if (agentId) {
      const agent = await prisma.aiAgent.findFirst({ where: { id: agentId, isActive: true } })
      if (!agent) return NextResponse.json({ error: 'Agente de IA não encontrado' }, { status: 404 })
    }

    let query = supabaseAdmin
      .from('whatsapp_conversations')
      .update(
        agentId
          ? { ai_enabled: true, ai_agent_id: agentId }
          : { ai_enabled: false, ai_agent_id: null }
      )
      .in('id', conversationIds)
    if (user.profileType !== 'master') query = query.eq('owner_user_id', String(user.id))

    const { data, error } = await query.select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
  })
}
