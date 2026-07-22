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

/**
 * Copia a foto do cadastro facial (privada) para o caminho público de
 * fotos de perfil e aponta `members.photo_url` para ela.
 *
 * O caminho é determinístico por lote: quando a igreja tem vários
 * leitores, os N jobs do mesmo lote gravam exatamente o mesmo valor,
 * então repetir a chamada é inofensivo.
 */
async function syncProfilePhoto(memberId: string, batchId: string, sourcePath: string) {
  const ext = sourcePath.endsWith('.png') ? 'png' : 'jpg'
  const publicPath = `member-photos/${memberId}/${batchId}.${ext}`

  try {
    const { error: copyError } = await supabaseAdmin.storage
      .from('dados')
      .copy(sourcePath, publicPath)

    // 'already exists' é esperado a partir do segundo leitor do lote
    if (copyError && !/exist/i.test(copyError.message)) {
      console.error('faceid-agent: falha ao copiar foto de perfil', copyError)
      return
    }

    const { data: pub } = supabaseAdmin.storage.from('dados').getPublicUrl(publicPath)

    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({ photo_url: pub.publicUrl })
      .eq('id', memberId)

    if (updateError) {
      console.error('faceid-agent: falha ao atualizar foto de perfil', updateError)
    }
  } catch (err) {
    // Nunca derruba o job: o cadastro no leitor já deu certo, e é isso
    // que importa. A foto de perfil é um efeito secundário.
    console.error('faceid-agent: erro inesperado ao sincronizar foto', err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const token = req.headers.get('x-agent-token')?.trim()
  if (!token) return NextResponse.json({ error: 'Token do agente ausente.' }, { status: 401 })

  // Descobre quais dispositivos este token pode reportar:
  //   token de agente (máquina) → todos os leitores com agent_id = agente
  //   token de dispositivo (compat) → só aquele leitor
  const allowedDeviceIds = new Set<string>()

  const { data: agent } = await supabaseAdmin
    .from('faceid_agents')
    .select('id')
    .eq('token', token)
    .maybeSingle()

  if (agent) {
    const { data: devs } = await supabaseAdmin
      .from('faceid_devices')
      .select('id')
      .eq('agent_id', agent.id)
    for (const d of devs || []) allowedDeviceIds.add(d.id)
  } else {
    const { data: device } = await supabaseAdmin
      .from('faceid_devices')
      .select('id, is_active')
      .eq('agent_token', token)
      .maybeSingle()
    if (!device) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    if (!device.is_active) return NextResponse.json({ error: 'Dispositivo desativado.' }, { status: 403 })
    allowedDeviceIds.add(device.id)
  }

  const body = await req.json().catch(() => ({}))
  const status = body.status as AllowedStatus

  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  const { data: job } = await supabaseAdmin
    .from('face_enrollment_jobs')
    .select('id, device_id, attempts, member_id, batch_id, photo_url')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 })
  if (!allowedDeviceIds.has(job.device_id)) {
    return NextResponse.json({ error: 'Job não pertence a este agente.' }, { status: 403 })
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

  // O aparelho aceitou o rosto: a mesma foto vira a foto de perfil do
  // membro, para o cadastro do leitor e o do sistema não divergirem.
  //
  // Só acontece no sucesso — foto recusada pelo leitor (borrada, mal
  // enquadrada) não deve virar foto de perfil.
  if (status === 'done' && job.member_id && job.photo_url) {
    await syncProfilePhoto(job.member_id, job.batch_id, job.photo_url)
  }

  return NextResponse.json({ ok: true })
}
