import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ZAPI_BASE = 'https://api.z-api.io'

// GET /api/whatsapp/instances/[id]?action=status|qr-code|disconnect|restart
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params
    const action = new URL(req.url).searchParams.get('action') ?? 'status'

    const { data: instance, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single()

    if (error || !instance) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

    const base = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Client-Token': instance.client_token,
    }

    if (action === 'status') {
      const res = await fetch(`${base}/status`, { headers })
      const json = await res.json()

      const isConnected = json.connected === true || json.status === 'CONNECTED'
      const newStatus = isConnected ? 'connected' : (json.status === 'QR_CODE' ? 'qr_code' : 'disconnected')

      await supabaseAdmin
        .from('whatsapp_instances')
        .update({ status: newStatus, phone_number: json.phoneNumber ?? instance.phone_number })
        .eq('id', id)

      return NextResponse.json({ status: newStatus, connected: isConnected, phoneNumber: json.phoneNumber ?? null })
    }

    if (action === 'qr-code') {
      const res = await fetch(`${base}/qr-code`, { headers })
      const json = await res.json()
      await supabaseAdmin.from('whatsapp_instances').update({ status: 'qr_code' }).eq('id', id)
      return NextResponse.json({ qrCode: json.qrcode ?? json.qrCode ?? json.value ?? null })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  })
}

// PATCH /api/whatsapp/instances/[id] — atualiza nome ou dispara ação Z-API
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const { data: instance, error: fetchErr } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single()

    if (fetchErr || !instance) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

    const { action, name, is_active } = body

    if (action === 'disconnect' || action === 'restart') {
      const base = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}`
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'Client-Token': instance.client_token }
      const path = action === 'disconnect' ? 'disconnect' : 'restart'
      // A Z-API expõe /restart e /disconnect como GET, não POST — POST retorna
      // 405 e o botão parecia "não fazer nada" (confirmado em produção em 2026-07-13).
      await fetch(`${base}/${path}`, { method: 'GET', headers })
      await supabaseAdmin.from('whatsapp_instances').update({ status: 'disconnected' }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, status, is_active')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  })
}

// DELETE /api/whatsapp/instances/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params

    const { error } = await supabaseAdmin
      .from('whatsapp_instances')
      .delete()
      .eq('id', id)
      .eq('owner_user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}
