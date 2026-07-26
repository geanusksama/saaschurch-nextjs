import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { postponeForTyping, kickQueue } from '@/lib/aiReplyQueue'

/**
 * POST /api/whatsapp/webhook/presence — webhook "on-chat-presence" da Z-API.
 *
 * Status possíveis (developer.z-api.io/webhooks/on-chat-presence.md):
 * composing | recording | available | unavailable.
 *
 * Serve para uma coisa só: enquanto o contato está digitando (ou gravando
 * áudio), a resposta do agente é adiada. Ninguém responde por cima de quem
 * ainda está escrevendo.
 *
 * Configurar na Z-API apontando para esta URL (a Z-API só aceita HTTPS).
 * REGRA: sempre 200 — a Z-API faz retry em 4xx/5xx.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({})) as {
      instanceId?: string
      phone?: string
      status?: string
    }

    const status = String(payload.status ?? '').toLowerCase()
    if (status !== 'composing' && status !== 'recording') {
      return NextResponse.json({ ok: true })
    }

    const phone = (payload.phone ?? '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
    if (!phone || !payload.instanceId) return NextResponse.json({ ok: true })

    const { data: instance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('instance_id', payload.instanceId)
      .maybeSingle()

    if (!instance) return NextResponse.json({ ok: true })

    const { data: conv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id')
      .eq('instance_id', instance.id)
      .eq('phone', phone)
      .maybeSingle()

    if (conv) {
      await postponeForTyping(conv.id)
      kickQueue()
    }
  } catch (err) {
    console.error('[whatsapp/webhook/presence] erro', err)
  }

  return NextResponse.json({ ok: true })
}
