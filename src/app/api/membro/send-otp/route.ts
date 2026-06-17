import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signToken, hashCode } from '@/lib/membroJwt'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTextViaZApi } from '@/lib/whatsappSendService'

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { challenge_token } = body as { challenge_token?: string }

  if (!challenge_token) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
  }

  const payload = verifyToken<{ member_id: string; phone: string }>(challenge_token)
  if (!payload) {
    return NextResponse.json({ error: 'Token expirado ou inválido. Reinicie o processo.' }, { status: 401 })
  }

  const phone = payload.phone.replace(/\D/g, '')
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: 'Telefone inválido no cadastro.' }, { status: 422 })
  }

  // Get first active WhatsApp instance (system-wide)
  const { data: instance } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('instance_id, token, client_token')
    .eq('is_active', true)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!instance) {
    return NextResponse.json({ error: 'Serviço de mensagens temporariamente indisponível.' }, { status: 503 })
  }

  const code = generateCode()
  const message = `🔐 Portal AD Campinas\n\nSeu código de acesso é:\n\n*${code}*\n\nVálido por 10 minutos. Não compartilhe este código.`

  const result = await sendTextViaZApi(instance, phone, message)
  if (result.status === 'error') {
    console.error('[send-otp] WhatsApp send failed:', result.error)
    return NextResponse.json({ error: 'Não foi possível enviar o código. Tente novamente.' }, { status: 502 })
  }

  const otpToken = signToken(
    { member_id: payload.member_id, code_hash: hashCode(code) },
    10 * 60 // 10 minutes
  )

  return NextResponse.json({ otp_token: otpToken })
}
