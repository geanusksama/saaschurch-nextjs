import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Fila de cadastro consumida pelo agente na rede da igreja.
 *
 * Autenticação (header `X-Agent-Token`), nesta ordem:
 *   1. token do AGENTE (faceid_agents) → cuida de TODOS os leitores da
 *      máquina (agent_id), possivelmente de igrejas diferentes.
 *   2. token de DISPOSITIVO (faceid_devices.agent_token) → compat com o
 *      modelo antigo de um agente por leitor.
 *
 * Cada job já vem com os dados de conexão do seu leitor, para o agente
 * rotear cada foto ao aparelho certo.
 */

type DeviceConn = {
  id: string
  name: string | null
  serial: string | null
  host: string | null
  port: number
  username: string | null
  password: string | null
}

async function resolveDevices(token: string): Promise<{ deviceIds: string[]; conn: Map<string, DeviceConn>; agentId?: string } | null> {
  // 1. Token de agente (máquina)
  const { data: agent } = await supabaseAdmin
    .from('faceid_agents')
    .select('id')
    .eq('token', token)
    .maybeSingle()

  if (agent) {
    await supabaseAdmin
      .from('faceid_agents')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', agent.id)

    const { data: devices } = await supabaseAdmin
      .from('faceid_devices')
      .select('id, name, serial, local_host, local_port, username, password, is_active')
      .eq('agent_id', agent.id)
      .eq('is_active', true)

    const conn = new Map<string, DeviceConn>()
    for (const d of devices || []) {
      conn.set(d.id, {
        id: d.id,
        name: d.name,
        serial: d.serial,
        host: d.local_host,
        port: d.local_port || 80,
        username: d.username,
        password: d.password,
      })
    }
    return { deviceIds: [...conn.keys()], conn, agentId: agent.id }
  }

  // 2. Token de dispositivo (compat)
  const { data: device } = await supabaseAdmin
    .from('faceid_devices')
    .select('id, name, serial, local_host, local_port, username, password, is_active')
    .eq('agent_token', token)
    .maybeSingle()

  if (device && device.is_active) {
    await supabaseAdmin
      .from('faceid_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device.id)

    const conn = new Map<string, DeviceConn>()
    conn.set(device.id, {
      id: device.id,
      name: device.name,
      serial: device.serial,
      host: device.local_host,
      port: device.local_port || 80,
      username: device.username,
      password: device.password,
    })
    return { deviceIds: [device.id], conn }
  }

  return null
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-agent-token')?.trim()
  if (!token) return NextResponse.json({ error: 'Token do agente ausente.' }, { status: 401 })

  const resolved = await resolveDevices(token)
  if (!resolved) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

  const { deviceIds, conn } = resolved
  if (deviceIds.length === 0) {
    return NextResponse.json({ jobs: [] })
  }

  const { data: jobs, error } = await supabaseAdmin
    .from('face_enrollment_jobs')
    .select('id, device_id, rol, nome, cpf, photo_url, allow_update, attempts')
    .in('device_id', deviceIds)
    .eq('status', 'pending')
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    console.error('faceid-agent/jobs: erro ao buscar fila', error)
    return NextResponse.json({ error: 'Erro ao buscar fila.' }, { status: 500 })
  }

  const out = await Promise.all(
    (jobs || []).map(async (job) => {
      const device = conn.get(job.device_id)
      if (!device || !device.host) return null

      const { data: signed } = await supabaseAdmin.storage
        .from('dados')
        .createSignedUrl(job.photo_url, 600)
      if (!signed?.signedUrl) return null

      return {
        id: job.id,
        rol: job.rol,
        nome: job.nome,
        cpf: job.cpf,
        allow_update: job.allow_update,
        attempts: job.attempts,
        photo_url: signed.signedUrl,
        device: {
          id: device.id,
          name: device.name,
          serial: device.serial,
          host: device.host,
          port: device.port,
          username: device.username,
          password: device.password,
        },
      }
    })
  )

  return NextResponse.json({ jobs: out.filter(Boolean) })
}
