import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Auto-cadastro de leitores descobertos pelo agente na rede da igreja.
 *
 * Autenticação: header `X-Agent-Token` com o token do AGENTE (máquina),
 * não do dispositivo. Um agente cuida de todos os leitores da sua rede.
 *
 * Body: { devices: [{ device_uid, physical_serial, host, port, model,
 *                      firmware, mac }] }
 *
 * Casa por device_uid (identidade estável do aparelho). Novo → cria com a
 * igreja "casa" do agente e is_sede=true. Existente → só atualiza dados de
 * rede/identidade, preservando o que você definiu na tela (igreja, sede).
 */

async function authAgent(req: NextRequest) {
  const token = req.headers.get('x-agent-token')?.trim()
  if (!token) return { error: 'Token do agente ausente.', status: 401 as const }

  const { data: agent, error } = await supabaseAdmin
    .from('faceid_agents')
    .select('id, church_id, name')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('provision: erro ao autenticar agente', error)
    return { error: 'Erro de autenticação.', status: 500 as const }
  }
  if (!agent) return { error: 'Token de agente inválido.', status: 401 as const }
  return { agent }
}

export async function POST(req: NextRequest) {
  const auth = await authAgent(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { agent } = auth

  const body = await req.json().catch(() => ({}))
  const devices = Array.isArray(body.devices) ? body.devices : []
  if (devices.length === 0) {
    return NextResponse.json({ error: 'Nenhum dispositivo informado.' }, { status: 400 })
  }

  // Heartbeat do agente
  await supabaseAdmin
    .from('faceid_agents')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', agent.id)

  const results: Array<{ device_uid: string; action: string }> = []

  for (const d of devices) {
    const deviceUid = String(d.device_uid || '').trim()
    if (!deviceUid) continue

    const host = d.host ? String(d.host).trim() : null
    const port = d.port ? Number(d.port) : 80
    const physicalSerial = d.physical_serial ? String(d.physical_serial).trim() : null

    const { data: existing } = await supabaseAdmin
      .from('faceid_devices')
      .select('id')
      .eq('device_uid', deviceUid)
      .maybeSingle()

    if (existing) {
      // Só atualiza rede/identidade. NÃO mexe em church_id, secondary,
      // is_sede, name — são definições feitas por você na tela.
      await supabaseAdmin
        .from('faceid_devices')
        .update({
          local_host: host,
          local_port: port,
          model: d.model || null,
          firmware: d.firmware || null,
          mac: d.mac || null,
          agent_id: agent.id,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      results.push({ device_uid: deviceUid, action: 'updated' })
    } else {
      // Nome sugerido a partir do serial físico; você renomeia na tela.
      const suggestedName =
        d.name?.trim() ||
        (physicalSerial ? `Leitor ${physicalSerial.split('/').pop()}` : `Leitor ${deviceUid.slice(-6)}`)

      const { error: insErr } = await supabaseAdmin.from('faceid_devices').insert({
        // serial = device_uid numérico: é o que o webhook de presença envia
        serial: deviceUid,
        device_uid: deviceUid,
        name: suggestedName,
        local_host: host,
        local_port: port,
        model: d.model || null,
        firmware: d.firmware || null,
        mac: d.mac || null,
        church_id: agent.church_id, // igreja "casa" do agente (você ajusta depois)
        is_sede: true, // padrão: dispositivo da Sede
        agent_id: agent.id,
        auto_provisioned: true,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      })

      if (insErr) {
        console.error('provision: erro ao inserir dispositivo', deviceUid, insErr)
        results.push({ device_uid: deviceUid, action: 'error' })
      } else {
        results.push({ device_uid: deviceUid, action: 'created' })
      }
    }
  }

  return NextResponse.json({
    church_id: agent.church_id,
    processed: results.length,
    results,
  })
}
