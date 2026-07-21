import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * O agente reporta o resultado de um job.
 *
 * PATCH body:
 *   { status: 'processing' | 'done' | 'failed',
 *     error_code?: number, error_message?: string, match_user_id?: number }
 */

const ALLOWED_STATUS = ['processing', 'done', 'failed'] as const
type AllowedStatus = (typeof ALLOWED_STATUS)[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const token = req.headers.get('x-agent-token')?.trim()
  if (!token) return NextResponse.json({ error: 'Token do agente ausente.' }, { status: 401 })

  const { data: device } = await supabaseAdmin
    .from('faceid_devices')
    .select('id, is_active')
    .eq('agent_token', token)
    .maybeSingle()

  if (!device) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
  if (!device.is_active) return NextResponse.json({ error: 'Dispositivo desativado.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const status = body.status as AllowedStatus

  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  // Um agente só pode reportar jobs do próprio dispositivo
  const { data: job } = await supabaseAdmin
    .from('face_enrollment_jobs')
    .select('id, device_id, attempts')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 })
  if (job.device_id !== device.id) {
    return NextResponse.json({ error: 'Job não pertence a este dispositivo.' }, { status: 403 })
  }

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'processing') {
    update.attempts = (job.attempts || 0) + 1
  } else {
    update.processed_at = new Date().toISOString()
  }

  if (status === 'failed') {
    update.error_code = body.error_code ?? null
    update.error_message = body.error_message ?? null
    update.match_user_id = body.match_user_id ?? null
  }

  if (status === 'done') {
    update.error_code = null
    update.error_message = null
    update.match_user_id = null
  }

  const { error } = await supabaseAdmin
    .from('face_enrollment_jobs')
    .update(update)
    .eq('id', id)

  if (error) {
    console.error('faceid-agent: erro ao atualizar job', error)
    return NextResponse.json({ error: 'Erro ao atualizar job.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
