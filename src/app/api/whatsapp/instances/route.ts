import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/whatsapp/instances — lista instâncias do usuário autenticado
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, name, instance_id, status, phone_number, is_active, created_at, updated_at')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  })
}

// POST /api/whatsapp/instances — cria nova instância
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { name, instance_id, token, client_token } = body

    if (!name || !instance_id || !token || !client_token) {
      return NextResponse.json({ error: 'Campos obrigatórios: name, instance_id, token, client_token' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .insert({
        name,
        instance_id,
        token,
        client_token,
        owner_user_id: user.id,
        status: 'disconnected',
        is_active: true,
      })
      .select('id, name, instance_id, status, phone_number, is_active, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  })
}
