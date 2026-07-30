import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateFormSchema } from '@/lib/secretariaCampaignFields'
import { campaignPublicUrl, generateToken } from '@/lib/secretariaCampaignService'
import { resolveVisibleChurches, ScopeError } from '@/lib/secretariaCampaignScope'

/**
 * GET  /api/secretaria/campaigns — lista as campanhas visíveis para o usuário
 * POST /api/secretaria/campaigns — cria a campanha e devolve o link de partilha
 */

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const status = sp.get('status')
    const kind = sp.get('kind')
    const q = (sp.get('q') ?? '').trim()

    let query = supabaseAdmin
      .from('secretaria_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (status && status !== 'all') query = query.eq('status', status)
    if (kind && kind !== 'all') query = query.eq('kind', kind)
    if (q) query = query.ilike('name', `%${q}%`)

    // Não-master enxerga o que é dele OU o que está numa igreja do seu escopo.
    if (user.profileType !== 'master') {
      try {
        const churches = await resolveVisibleChurches(user)
        const ids = churches.map(c => c.id)
        query = ids.length
          ? query.or(`owner_user_id.eq.${String(user.id)},church_id.in.(${ids.join(',')})`)
          : query.eq('owner_user_id', String(user.id))
      } catch (e) {
        if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: e.status })
        throw e
      }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      campaigns: (data ?? []).map(c => ({ ...c, shareUrl: campaignPublicUrl(c.share_token) })),
    })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const {
      name,
      reason,
      description,
      kind = 'form',
      formSchema = [],
      messageTemplate,
      imageUrl,
      videoUrl,
      linkUrl,
      instanceId,
      requireIdentification = true,
      opensAt,
      closesAt,
      churchId,
      status = 'active',
    } = body as Record<string, unknown>

    const nome = String(name ?? '').trim()
    if (!nome) return NextResponse.json({ error: 'Dê um nome para a campanha.' }, { status: 400 })

    const tipo = kind === 'broadcast' ? 'broadcast' : 'form'

    // Formulário sem pergunta não tem o que aprovar; comunicado sem conteúdo não
    // tem o que enviar. As duas checagens evitam campanha nascida morta.
    let fields: ReturnType<typeof validateFormSchema>['fields'] = []
    if (tipo === 'form') {
      const parsed = validateFormSchema(formSchema)
      if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(' ') }, { status: 400 })
      if (!parsed.fields.length) {
        return NextResponse.json({ error: 'Adicione pelo menos uma pergunta ao formulário.' }, { status: 400 })
      }
      fields = parsed.fields
    } else if (!String(messageTemplate ?? '').trim() && !String(imageUrl ?? '').trim() && !String(videoUrl ?? '').trim()) {
      return NextResponse.json(
        { error: 'Um comunicado precisa de pelo menos um texto, uma imagem ou um vídeo.' },
        { status: 400 }
      )
    }

    // a igreja da campanha precisa estar no escopo de quem cria
    let alvoChurchId: string | null = user.churchId ?? null
    try {
      const churches = await resolveVisibleChurches(user)
      if (churchId) {
        const pedida = String(churchId)
        if (!churches.some(c => c.id === pedida)) {
          return NextResponse.json({ error: 'Igreja fora do seu acesso.' }, { status: 403 })
        }
        alvoChurchId = pedida
      } else if (!alvoChurchId && churches.length === 1) {
        alvoChurchId = churches[0].id
      }
    } catch (e) {
      if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('secretaria_campaigns')
      .insert({
        church_id: alvoChurchId,
        owner_user_id: String(user.id),
        name: nome,
        reason: String(reason ?? '').trim() || null,
        description: String(description ?? '').trim() || null,
        kind: tipo,
        status: status === 'draft' ? 'draft' : 'active',
        form_schema: fields,
        message_template: String(messageTemplate ?? '').trim() || null,
        image_url: String(imageUrl ?? '').trim() || null,
        video_url: String(videoUrl ?? '').trim() || null,
        link_url: String(linkUrl ?? '').trim() || null,
        instance_id: instanceId ? String(instanceId) : null,
        share_token: generateToken(10),
        require_identification: tipo === 'form' ? requireIdentification !== false : false,
        opens_at: opensAt ? new Date(String(opensAt)).toISOString() : null,
        closes_at: closesAt ? new Date(String(closesAt)).toISOString() : null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Erro ao criar a campanha.' }, { status: 500 })
    }

    return NextResponse.json({ campaign: { ...data, shareUrl: campaignPublicUrl(data.share_token) } })
  })
}
