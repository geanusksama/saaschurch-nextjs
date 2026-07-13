import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { summarize } from '@/lib/whatsappImportService'

interface RowRecord {
  match_status: string
  decision: string
}

const toSummaryInput = (rows: RowRecord[] | null) =>
  (rows ?? []).map(r => ({ status: r.match_status, decision: r.decision }))

const SKIP_REASONS: Record<string, string> = {
  invalid: 'Telefone inválido',
  duplicate_in_file: 'Número repetido no arquivo',
  member: 'Já cadastrado como membro',
  pipeline: 'Já existe no pipeline',
  both: 'Já é membro e já está no pipeline',
}

async function loadBatch(id: string, userId: string, profileType?: string) {
  const { data } = await supabaseAdmin
    .from('whatsapp_import_batches')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  if (profileType !== 'master' && data.owner_user_id !== userId) return null
  return data
}

// GET /api/whatsapp/imports/[id] — lote + linhas (o de-para completo)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const batch = await loadBatch(id, String(user.id), user.profileType)
    if (!batch) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

    const { data: rows, error } = await supabaseAdmin
      .from('whatsapp_import_rows')
      .select('*')
      .eq('batch_id', id)
      .order('row_number', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // status do envio de cada linha vem do destinatário da campanha
    const recipientIds = (rows ?? []).map(r => r.recipient_id).filter(Boolean) as string[]
    const sendState = new Map<string, { status: string; sent_at: string | null; error_message: string | null }>()
    if (recipientIds.length) {
      const { data: recs } = await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .select('id, status, sent_at, error_message')
        .in('id', recipientIds)
      for (const r of recs ?? []) {
        sendState.set(r.id, { status: r.status, sent_at: r.sent_at, error_message: r.error_message })
      }
    }

    const enriched = (rows ?? []).map(r => ({
      ...r,
      send_status: r.recipient_id ? sendState.get(r.recipient_id)?.status ?? null : null,
      sent_at: r.recipient_id ? sendState.get(r.recipient_id)?.sent_at ?? null : null,
      send_error: r.recipient_id ? sendState.get(r.recipient_id)?.error_message ?? null : null,
    }))

    return NextResponse.json({
      batch,
      rows: enriched,
      summary: summarize(toSummaryInput(rows)),
    })
  })
}

/**
 * PATCH /api/whatsapp/imports/[id] — reavalia quem entra no envio.
 * Body: { includeMembers?, includePipeline? }
 *
 * Telefone inválido e duplicado no arquivo NUNCA entram. Membro e contato já
 * no pipeline só entram se o usuário marcar "enviar mesmo assim".
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const batch = await loadBatch(id, String(user.id), user.profileType)
    if (!batch) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (batch.campaign_id) {
      return NextResponse.json({ error: 'Lote já enviado — não pode ser alterado' }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const includeMembers = body.includeMembers === true
    const includePipeline = body.includePipeline === true

    const decisionFor = (status: string): boolean => {
      if (status === 'member') return includeMembers
      if (status === 'pipeline') return includePipeline
      if (status === 'both') return includeMembers && includePipeline
      return status === 'new'
    }

    for (const status of ['new', 'member', 'pipeline', 'both']) {
      const send = decisionFor(status)
      await supabaseAdmin
        .from('whatsapp_import_rows')
        .update({
          decision: send ? 'send' : 'skip',
          skip_reason: send ? null : SKIP_REASONS[status] ?? null,
        })
        .eq('batch_id', id)
        .eq('match_status', status)
    }

    const { data: rows } = await supabaseAdmin
      .from('whatsapp_import_rows')
      .select('match_status, decision')
      .eq('batch_id', id)

    const summary = summarize(toSummaryInput(rows))
    await supabaseAdmin
      .from('whatsapp_import_batches')
      .update({ valid_rows: summary.sendable })
      .eq('id', id)

    return NextResponse.json({ summary })
  })
}
