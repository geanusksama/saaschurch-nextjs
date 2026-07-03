import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'

// POST /api/whatsapp/send-direct
// Mensagem individual pela instância ESCOLHIDA (não abre WhatsApp Web).
// Body: { instanceId, phone, message, contactName?, imageUrl?, linkUrl? }
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { instanceId, phone, message, contactName, imageUrl, linkUrl } = body as {
      instanceId?: string
      phone?: string
      message?: string
      contactName?: string
      imageUrl?: string
      linkUrl?: string
    }

    if (!instanceId) {
      return NextResponse.json({ error: 'Selecione uma instância' }, { status: 400 })
    }
    const normalizedPhone = (phone ?? '').replace(/\D/g, '')
    if (!normalizedPhone || !message?.trim()) {
      return NextResponse.json({ error: 'phone e message são obrigatórios' }, { status: 400 })
    }

    // instância precisa pertencer ao usuário (master usa qualquer)
    let instQuery = supabaseAdmin
      .from('whatsapp_instances')
      .select('id, status')
      .eq('id', instanceId)
      .eq('is_active', true)
    if (user.profileType !== 'master') instQuery = instQuery.eq('owner_user_id', String(user.id))
    const { data: instance } = await instQuery.single()

    if (!instance) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    if (instance.status !== 'connected') {
      return NextResponse.json({ error: 'Instância não está conectada' }, { status: 400 })
    }

    const finalMessage = linkUrl?.trim() ? `${message}\n\n${linkUrl.trim()}` : message

    const result = await quickSendWhatsApp({
      ownerUserId: String(user.id),
      profileType: user.profileType,
      instanceId,
      phone: normalizedPhone,
      message: finalMessage,
      contactName,
      imageUrl: imageUrl?.trim() || undefined,
    })

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error ?? 'Falha no envio' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, messageId: result.messageId })
  })
}
