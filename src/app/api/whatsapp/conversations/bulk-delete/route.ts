import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * POST /api/whatsapp/conversations/bulk-delete
 *
 * Exclusao definitiva de varias conversas de uma vez. As mensagens somem
 * junto: whatsapp_messages.conversation_id tem ON DELETE CASCADE.
 *
 * master apaga qualquer conversa; os demais perfis so as proprias — mesma
 * regra de dono usada no PATCH/DELETE de conversa individual.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string') : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenhuma conversa informada.' }, { status: 400 })
    }

    let query = supabaseAdmin.from('whatsapp_conversations').delete().in('id', ids)
    if (user.profileType !== 'master') query = query.eq('owner_user_id', user.id)

    const { data, error } = await query.select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const deleted = data?.length ?? 0
    return NextResponse.json({ deleted, requested: ids.length })
  })
}
