import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Endpoint consumido pelo agente que roda na rede local da igreja.
 *
 * Autenticação: header `X-Agent-Token` com o `agent_token` do dispositivo.
 * O agente nunca acessa o banco direto — assim a máquina da igreja não
 * guarda credencial do Postgres, e revogar um agente é trocar um token.
 */

async function authenticate(req: NextRequest) {
  const token = req.headers.get('x-agent-token')?.trim()
  if (!token) return { error: 'Token do agente ausente.', status: 401 as const }

  const { data: device, error } = await supabaseAdmin
    .from('faceid_devices')
    .select('id, name, serial, church_id, local_host, local_port, username, password, is_active')
    .eq('agent_token', token)
    .maybeSingle()

  if (error) {
    console.error('faceid-agent: erro ao autenticar', error)
    return { error: 'Erro de autenticação.', status: 500 as const }
  }
  if (!device) return { error: 'Token inválido.', status: 401 as const }
  if (!device.is_active) return { error: 'Dispositivo desativado.', status: 403 as const }

  return { device }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { device } = auth

  // Heartbeat: a tela de dispositivos mostra se o agente está vivo
  await supabaseAdmin
    .from('faceid_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id)

  const { data: jobs, error } = await supabaseAdmin
    .from('face_enrollment_jobs')
    .select('id, rol, nome, cpf, photo_url, allow_update, attempts')
    .eq('device_id', device.id)
    .eq('status', 'pending')
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) {
    console.error('faceid-agent: erro ao buscar jobs', error)
    return NextResponse.json({ error: 'Erro ao buscar fila.' }, { status: 500 })
  }

  // Gera URL assinada por job (a foto não fica pública no storage)
  const withPhotos = await Promise.all(
    (jobs || []).map(async (job) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('dados')
        .createSignedUrl(job.photo_url, 600)

      return {
        id: job.id,
        rol: job.rol,
        nome: job.nome,
        cpf: job.cpf,
        allow_update: job.allow_update,
        attempts: job.attempts,
        photo_url: signed?.signedUrl || null,
      }
    })
  )

  return NextResponse.json({
    device: {
      id: device.id,
      name: device.name,
      serial: device.serial,
      host: device.local_host,
      port: device.local_port || 80,
      username: device.username,
      password: device.password,
    },
    jobs: withPhotos.filter((j) => j.photo_url),
  })
}
