import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// PATCH /api/whatsapp/messages/[id] — adiciona/remove reação
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params
    const { reaction } = await req.json().catch(() => ({}))

    if (!reaction) return NextResponse.json({ error: 'reaction é obrigatório' }, { status: 400 })

    const { data: msg } = await supabaseAdmin
      .from('whatsapp_messages').select('metadata').eq('id', id).single()

    const meta = (msg?.metadata as Record<string, unknown>) ?? {}
    const reactions = ({ ...(meta.reactions as Record<string, number>) } ?? {}) as Record<string, number>

    // Toggle: se já tem, remove; se não tem, incrementa
    if (reactions[reaction]) {
      reactions[reaction]--
      if (reactions[reaction] <= 0) delete reactions[reaction]
    } else {
      reactions[reaction] = 1
    }

    const { error } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({ metadata: { ...meta, reactions } })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}

// DELETE /api/whatsapp/messages/[id] — remove mensagem (soft: status=deleted)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params

    const { error } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({ status: 'deleted', content: null })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}
