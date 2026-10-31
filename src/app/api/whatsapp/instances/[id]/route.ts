import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { lerRecepcao, palavraChaveValida } from '@/lib/recepcaoWhatsapp'
import { canUseAgent, loadAgentAccess } from '@/lib/aiAgentAccess'

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

    if (action === 'details') {
      return NextResponse.json({
        id: instance.id,
        name: instance.name,
        instance_id: instance.instance_id,
        token: instance.token,
        client_token: instance.client_token,
        is_active: instance.is_active,
        phone_number: instance.phone_number,
        webhook_url: instance.webhook_url,
        recepcao: lerRecepcao(instance.metadata),
      })
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

    const { action, name, is_active, instance_id, token, client_token, recepcao } = body

    // Aponta os webhooks da Z-API para ESTE sistema. Até aqui isso só era
    // feito à mão no painel da Z-API — e se a instância estiver apontada para
    // outro sistema, nada chega aqui (nem inbox, nem agente de IA).
    // Endpoints: developer.z-api.io/en/webhooks (PUT update-webhook-*, body { value }).
    if (action === 'connect-webhook') {
      const negado = await exigirPermissao(user, 'tela_comunicacao.whats_app_instances.conectar_webhook')
      if (negado) return negado

      const baseUrl = String(body.baseUrl ?? '').trim().replace(/\/+$/, '')
      if (!/^https:\/\/[^\s/]+/.test(baseUrl)) {
        return NextResponse.json({ error: 'Informe a URL do sistema começando com https:// (a Z-API não aceita http).' }, { status: 400 })
      }

      const recebidas = `${baseUrl}/api/whatsapp/webhook`
      const alvos: { path: string; value: string; rotulo: string }[] = [
        { path: 'update-webhook-received', value: recebidas, rotulo: 'Mensagens recebidas' },
        // com "notificar enviadas por mim" ligado a Z-API usa ESTA url no lugar da de cima
        { path: 'update-webhook-received-delivery', value: recebidas, rotulo: 'Recebidas e enviadas por mim' },
        { path: 'update-webhook-message-status', value: recebidas, rotulo: 'Status das mensagens' },
        { path: 'update-webhook-chat-presence', value: `${baseUrl}/api/whatsapp/webhook/presence`, rotulo: 'Digitando...' },
      ]

      const base = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}`
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'Client-Token': instance.client_token }
      const resultados = await Promise.all(alvos.map(async a => {
        try {
          const r = await fetch(`${base}/${a.path}`, { method: 'PUT', headers, body: JSON.stringify({ value: a.value }) })
          const txt = await r.text().catch(() => '')
          return { webhook: a.rotulo, url: a.value, ok: r.ok, status: r.status, resposta: txt.slice(0, 200) }
        } catch (e) {
          return { webhook: a.rotulo, url: a.value, ok: false, status: 0, resposta: e instanceof Error ? e.message : 'falha de rede' }
        }
      }))

      const todosOk = resultados.every(r => r.ok)
      // Registra assim que a principal (mensagens recebidas) passou: daí em
      // diante a instância já saiu do outro sistema, mesmo que o resto falhe.
      if (resultados[0].ok) {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({ webhook_url: recebidas, updated_at: new Date().toISOString() })
          .eq('id', id)
      }
      return NextResponse.json({ ok: todosOk, resultados }, { status: todosOk ? 200 : 502 })
    }

    // Recepção por QR code — grava em metadata.recepcao (ver src/lib/recepcaoWhatsapp.ts)
    if (recepcao !== undefined) {
      const negado = await exigirPermissao(user, 'tela_comunicacao.whats_app_instances.qr_recepcao')
      if (negado) return negado

      const cfg = lerRecepcao({ recepcao })
      if (cfg.ativo) {
        if (!cfg.agentId) {
          return NextResponse.json({ error: 'Escolha o agente de IA que vai atender.' }, { status: 400 })
        }
        // agente precisa ser do campo ativo (ou global) e estar ativo
        const agente = await prisma.aiAgent.findFirst({
          where: { id: cfg.agentId, isActive: true, OR: [{ campoId: user.campoId || null }, { campoId: null }] },
          select: { id: true },
        })
        if (!agente) {
          return NextResponse.json({ error: 'Agente de IA não encontrado ou inativo.' }, { status: 400 })
        }
        // mesma regra do assign-ai: agente com lista de autorizados só por quem está nela
        const access = await loadAgentAccess(user.id ? String(user.id) : null)
        if (!canUseAgent(agente.id, access)) {
          return NextResponse.json({ error: 'Você não está autorizado a usar este agente.' }, { status: 403 })
        }
        if (!palavraChaveValida(cfg.palavraChave, cfg.mensagem)) {
          return NextResponse.json(
            { error: 'A mensagem do QR precisa conter a palavra-chave, senão o agente não é acionado.' },
            { status: 400 },
          )
        }
      }

      const metadata = { ...((instance.metadata as Record<string, unknown>) ?? {}), recepcao: cfg }
      const { error } = await supabaseAdmin
        .from('whatsapp_instances')
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ recepcao: cfg })
    }

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
    if (instance_id !== undefined) updates.instance_id = instance_id
    if (token !== undefined) updates.token = token
    if (client_token !== undefined) updates.client_token = client_token

    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, status, is_active, instance_id, token, client_token')
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
