import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// PATCH /api/whatsapp/conversations/[id]
// Atualiza status, ai_enabled, assigned_to, zera unread_count, etc.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const convQ = supabaseAdmin.from('whatsapp_conversations').select('id').eq('id', id)
    if (user.profileType !== 'master') convQ.eq('owner_user_id', user.id)
    const { data: conv } = await convQ.single()

    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    const allowed = ['status', 'ai_enabled', 'assigned_to', 'unread_count', 'contact_name']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (k in body) updates[k] = body[k]
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  })
}

// DELETE /api/whatsapp/conversations/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params

    const { error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .delete()
      .eq('id', id)
      .eq('owner_user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}
