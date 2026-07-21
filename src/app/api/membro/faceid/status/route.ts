import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { describeFaceidError, isSelfRematch } from '@/lib/faceidErrors'

type MemberPayload = { sub: string }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, batchId } = body as { token?: string; batchId?: string }

  if (!token) return NextResponse.json({ error: 'Token obrigatório.' }, { status: 401 })

  const payload = verifyToken<MemberPayload>(token)
  if (!payload) return NextResponse.json({ error: 'Token expirado ou inválido.' }, { status: 401 })

  let query = supabaseAdmin
    .from('face_enrollment_jobs')
    .select(
      'id, batch_id, status, rol, error_code, error_message, match_user_id, created_at, processed_at, device_id, faceid_devices(name)'
    )
    .eq('member_id', payload.sub)
    .order('created_at', { ascending: false })

  if (batchId) query = query.eq('batch_id', batchId)
  else query = query.limit(20)

  const { data, error } = await query

  if (error) {
    console.error('faceid/status: erro ao consultar jobs', error)
    return NextResponse.json({ error: 'Erro ao consultar o andamento.' }, { status: 500 })
  }

  const jobs = data || []
  if (jobs.length === 0) {
    return NextResponse.json({ state: 'none', devices: [] })
  }

  // Considera apenas o lote mais recente quando nenhum foi pedido
  const targetBatch = batchId || jobs[0].batch_id
  const batch = jobs.filter((j) => j.batch_id === targetBatch)

  const devices = batch.map((j) => {
    const dev = j.faceid_devices as { name?: string } | null
    const base = {
      id: j.id,
      device: dev?.name || 'Leitor',
      status: j.status as string,
    }

    if (j.status !== 'failed') return { ...base, message: null, canRetry: false, canUpdate: false }

    const info = describeFaceidError(j.error_code, j.error_message)
    return {
      ...base,
      message: info.message,
      canRetry: info.retry,
      canUpdate: isSelfRematch(j.error_code, j.match_user_id, j.rol),
    }
  })

  // Estado agregado do lote: o membro só está "pronto" se todos os
  // leitores da igreja aceitarem — senão ele falha numa das entradas.
  const statuses = batch.map((j) => j.status)
  let state: string
  if (statuses.every((s) => s === 'done')) state = 'done'
  else if (statuses.some((s) => s === 'pending' || s === 'processing')) state = 'processing'
  else if (statuses.some((s) => s === 'needs_approval')) state = 'needs_approval'
  else if (statuses.every((s) => s === 'failed' || s === 'rejected')) state = 'failed'
  else state = 'partial'

  // Mensagem mais útil do lote: primeira falha encontrada
  const firstFailure = devices.find((d) => d.status === 'failed')

  return NextResponse.json({
    state,
    batch_id: targetBatch,
    devices,
    message: firstFailure?.message || null,
    canRetry: firstFailure?.canRetry ?? false,
    canUpdate: devices.some((d) => d.canUpdate),
  })
}
