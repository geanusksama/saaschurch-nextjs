import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'

// GET /api/whatsapp/instances/[id]/users — lista usuários autorizados
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params

    const { data: inst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single()
    if (!inst) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    const { data } = await supabaseAdmin
      .from('whatsapp_instance_users')
      .select('user_id, created_at')
      .eq('instance_id', id)

    return NextResponse.json(data ?? [])
  })
}

// POST /api/whatsapp/instances/[id]/users — adiciona usuário
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { user_id } = body
    if (!user_id) return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })

    const { data: inst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single()
    if (!inst) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('whatsapp_instance_users')
      .upsert({ instance_id: id, user_id, added_by: user.id }, { onConflict: 'instance_id,user_id', ignoreDuplicates: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}

// DELETE /api/whatsapp/instances/[id]/users?userId=xxx — remove usuário
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params
    const userId = new URL(req.url).searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    const { data: inst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single()
    if (!inst) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    await supabaseAdmin
      .from('whatsapp_instance_users')
      .delete()
      .eq('instance_id', id)
      .eq('user_id', userId)

    return NextResponse.json({ success: true })
  })
}
