import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assignAgentsRoundRobin, type CampaignRecipientInput } from '@/lib/whatsappCampaignService'
import { getAccessibleInstanceIds, normalizarNumeroBrasil } from '@/lib/whatsappSendService'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { validarCampanhaOficial } from '@/lib/meta/campanhaOficial'
import { buscar as buscarModelo } from '@/lib/meta/modelosRepo'

// GET /api/whatsapp/campaigns — lista campanhas do usuário (master vê todas)
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    let query = supabaseAdmin
      .from('whatsapp_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (user.profileType !== 'master') {
      query = query.eq('owner_user_id', String(user.id))
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaigns: data ?? [] })
  })
}

// POST /api/whatsapp/campaigns — cria campanha + destinatários
// Body: { name?, messageTemplate, intervalSeconds?, instanceIds[], agentUserIds?[], recipients[], autoStart? }
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const {
      name,
      messageTemplate,
      intervalSeconds = 5,
      instanceIds = [],
      agentUserIds = [],
      recipients = [],
      autoStart = true,
      imageUrl,
      linkUrl,
      metaModeloId,
      metaVariaveis,
    } = body as {
      name?: string
      messageTemplate?: string
      intervalSeconds?: number
      instanceIds?: string[]
      agentUserIds?: string[]
      recipients?: CampaignRecipientInput[]
      autoStart?: boolean
      imageUrl?: string
      linkUrl?: string
      /** Número oficial (Meta): modelo aprovado do campo e de onde vem cada variável. */
      metaModeloId?: string
      metaVariaveis?: Record<string, unknown>
    }

    const querOficial = typeof metaModeloId === 'string' && metaModeloId.length > 0
    if (!querOficial && !messageTemplate?.trim()) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }
    if (!Array.isArray(instanceIds) || !instanceIds.length) {
      return NextResponse.json({ error: 'Selecione ao menos uma instância' }, { status: 400 })
    }
    const validRecipients = (recipients ?? []).filter(r => r?.phone?.replace(/\D/g, ''))
    if (!validRecipients.length) {
      return NextResponse.json({ error: 'Selecione ao menos um destinatário com telefone' }, { status: 400 })
    }

    // valida instâncias: precisam existir, estar ativas e o usuário ser dono OU
    // autorizado (whatsapp_instance_users) — master usa qualquer
    let oficial: { modeloId: string; modeloNome: string; variaveis: Record<string, unknown> } | null = null
    const accessible = await getAccessibleInstanceIds(String(user.id), user.profileType, user.campoId ?? null)
    const allowedIds = accessible ? instanceIds.filter((id: string) => accessible.has(id)) : instanceIds
    // Número oficial de outro campo nunca é revelado nem usado: 404.
    const { data: pedidas } = instanceIds.length
      ? await supabaseAdmin.from('whatsapp_instances').select('id, provider, campo_id').in('id', instanceIds)
      : { data: [] }
    if ((pedidas ?? []).some(i => i.provider === 'meta' && (!user.campoId || i.campo_id !== user.campoId))) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }
    const { data: instances } = allowedIds.length
      ? await supabaseAdmin.from('whatsapp_instances').select('id, name, status, provider, campo_id').in('id', allowedIds).eq('is_active', true)
      : { data: [] }
    const connected = (instances ?? []).filter(i => i.status === 'connected')
    if (!connected.length) {
      return NextResponse.json(
        { error: 'Nenhuma das instâncias selecionadas está conectada' },
        { status: 400 }
      )
    }

    // Campanha pelo número oficial: só modelo aprovado do campo, e só com a permissão própria.
    const temOficial = connected.some(i => i.provider === 'meta')
    if (!temOficial && querOficial) {
      return NextResponse.json({ error: 'O modelo só vale para o número oficial do WhatsApp.' }, { status: 400 })
    }
    if (temOficial) {
      const negado = await exigirPermissao(user, 'whatsapp_oficial.campanha.enviar')
      if (negado) return negado
      const modelo = querOficial && user.campoId ? await buscarModelo(user.campoId, metaModeloId as string) : null
      const variaveis = metaVariaveis && typeof metaVariaveis === 'object' && !Array.isArray(metaVariaveis) ? metaVariaveis : {}
      const validacao = validarCampanhaOficial({
        instancias: connected.map(i => ({ provider: i.provider ?? 'zapi', campo_id: i.campo_id ?? null })),
        campoAtivo: user.campoId ?? '',
        modelo: modelo
          ? {
              status: modelo.status,
              campoId: modelo.campoId,
              variaveis: Array.isArray(modelo.variaveis) ? (modelo.variaveis as Array<{ posicao: number }>) : [],
            }
          : null,
        variaveis,
      })
      if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 })
      oficial = { modeloId: modelo!.id, modeloNome: modelo!.nome, variaveis }
    }

    const now = new Date()
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        church_id: user.churchId ?? null,
        owner_user_id: String(user.id),
        name: name?.trim() || `Campanha ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        message_template: oficial ? `Modelo oficial: ${oficial.modeloNome}` : messageTemplate,
        status: autoStart ? 'running' : 'draft',
        // 5 s é o mínimo por instância (risco de ban) — configurável para mais
        interval_seconds: Math.max(5, Number(intervalSeconds) || 5),
        total_recipients: validRecipients.length,
        agent_user_ids: agentUserIds,
        image_url: imageUrl?.trim() || null,
        link_url: linkUrl?.trim() || null,
        started_at: autoStart ? now.toISOString() : null,
        ...(oficial ? { meta_modelo_id: oficial.modeloId, meta_variaveis: oficial.variaveis } : {}),
      })
      .select('*')
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: campErr?.message ?? 'Erro ao criar campanha' }, { status: 500 })
    }

    await supabaseAdmin.from('whatsapp_campaign_instances').insert(
      connected.map(i => ({ campaign_id: campaign.id, instance_id: i.id }))
    )

    // agentes distribuídos round-robin já na criação
    const rows = assignAgentsRoundRobin(
      validRecipients.map(r => ({
        campaign_id: campaign.id,
        // 'import' = linha de uma lista CSV/Excel (whatsapp_import_rows)
        source:
          r.source === 'pipeline' ? 'pipeline' : r.source === 'import' ? 'import' : 'member',
        source_id: String(r.sourceId),
        name: r.name ?? null,
        // grava já com DDI (55) — a Z-API exige. Número irrecuperável fica
        // com os dígitos crus e o tick o marca como erro, em vez de sair
        // "enviado" para um destino que nunca recebe.
        phone: normalizarNumeroBrasil(r.phone) || r.phone.replace(/\D/g, ''),
        variables: r.variables ?? {},
        agent_user_id: null as string | null,
      })),
      (agentUserIds ?? []).map(String)
    )

    // insere em lotes para não estourar payload
    for (let i = 0; i < rows.length; i += 500) {
      const { error: recErr } = await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .insert(rows.slice(i, i + 500))
      if (recErr) {
        await supabaseAdmin.from('whatsapp_campaigns').delete().eq('id', campaign.id)
        return NextResponse.json({ error: recErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ campaign }, { status: 201 })
  })
}
