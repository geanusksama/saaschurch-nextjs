import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateSmartSummary } from '@/lib/aiReplyService'

// POST /api/whatsapp/conversations/[id]/smart
// Resumo inteligente da conversa: resumo, quem mais falou, análise e
// mensagem sugerida pronta para enviar.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params

    let convQuery = supabaseAdmin.from('whatsapp_conversations').select('id').eq('id', id)
    if (user.profileType !== 'master') convQuery = convQuery.eq('owner_user_id', String(user.id))
    const { data: conv } = await convQuery.single()
    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    try {
      const summary = await generateSmartSummary(id, user.campoId)
      return NextResponse.json(summary)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar resumo'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  })
}
