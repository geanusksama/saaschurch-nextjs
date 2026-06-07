import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/whatsapp/conversations?instanceId=&status=open&search=
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const instanceId = sp.get('instanceId')
    const status = sp.get('status')
    const search = sp.get('search')

    let query = supabaseAdmin
      .from('whatsapp_conversations')
      .select(`
        id, instance_id, phone, contact_name, status, ai_enabled,
        assigned_to, owner_user_id, last_message_at, last_message, unread_count,
        metadata, created_at, updated_at,
        whatsapp_instances(id, name, phone_number)
      `)
      .order('last_message_at', { ascending: false })
      .limit(100)

    // master vê todas; outros filtram pelo próprio owner_user_id
    if (user.profileType !== 'master') query = query.eq('owner_user_id', user.id)

    if (instanceId) query = query.eq('instance_id', instanceId)
    if (status) query = query.eq('status', status)
    if (search) query = query.or(`phone.ilike.%${search}%,contact_name.ilike.%${search}%,last_message.ilike.%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const mapped = (data ?? []).map((c: Record<string, unknown>) => ({
      ...c,
      instance: c.whatsapp_instances ?? null,
      whatsapp_instances: undefined,
    }))

    return NextResponse.json(mapped)
  })
}

// POST /api/whatsapp/conversations — cria conversa manual
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { instance_id, phone, contact_name } = body

    if (!instance_id || !phone) {
      return NextResponse.json({ error: 'instance_id e phone são obrigatórios' }, { status: 400 })
    }

    const normalized = String(phone).replace(/\D/g, '')

    const { data: inst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('id', instance_id)
      .eq('owner_user_id', user.id)
      .single()

    if (!inst) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .upsert({
        instance_id,
        phone: normalized,
        contact_name: contact_name ?? null,
        owner_user_id: user.id,
        status: 'open',
      }, { onConflict: 'instance_id,phone', ignoreDuplicates: false })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  })
}
