import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/whatsapp/instances — instâncias próprias + autorizadas (master vê todas)
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const cols = 'id, name, instance_id, status, phone_number, is_active, created_at, updated_at'

    // Master enxerga todas as instâncias do sistema
    if (user.profileType === 'master') {
      const { data, error } = await supabaseAdmin
        .from('whatsapp_instances')
        .select(cols)
        .order('created_at', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data ?? [])
    }

    // Demais: instâncias próprias + as que o usuário está autorizado a usar
    const { data: owned, error: ownErr } = await supabaseAdmin
      .from('whatsapp_instances')
      .select(cols)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true })
    if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 })

    const { data: links } = await supabaseAdmin
      .from('whatsapp_instance_users')
      .select('instance_id')
      .eq('user_id', user.id)

    const ownedIds = new Set((owned ?? []).map((i: any) => i.id))
    const authIds = (links ?? []).map((l: any) => l.instance_id).filter((id: string) => !ownedIds.has(id))

    let authorized: any[] = []
    if (authIds.length) {
      const { data: extra } = await supabaseAdmin
        .from('whatsapp_instances')
        .select(cols)
        .in('id', authIds)
      authorized = extra ?? []
    }

    return NextResponse.json([...(owned ?? []), ...authorized])
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
