import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyzeRows, resolveScopeChurchIds, summarize } from '@/lib/whatsappImportService'

// GET /api/whatsapp/imports — lotes importados (master vê todos)
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    let query = supabaseAdmin
      .from('whatsapp_import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (user.profileType !== 'master') query = query.eq('owner_user_id', String(user.id))

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ batches: data ?? [] })
  })
}

/**
 * POST /api/whatsapp/imports — fase 2 do modal: analisa o arquivo.
 *
 * Recebe as linhas já lidas no navegador (CSV/XLSX) + o de-para de colunas,
 * valida telefones, marca duplicados e cruza com membros e pipeline. Persiste
 * o lote e devolve o resumo — nenhuma mensagem é enviada aqui.
 *
 * Body: { filename, mapping, rows[], includeMembers?, includePipeline? }
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const {
      filename,
      mapping = {},
      rows = [],
      includeMembers = false,
      includePipeline = false,
    } = body as {
      filename?: string
      mapping?: Record<string, string>
      rows?: Array<Record<string, string>>
      includeMembers?: boolean
      includePipeline?: boolean
    }

    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: 'Arquivo sem linhas' }, { status: 400 })
    }
    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Limite de 5.000 linhas por arquivo' }, { status: 400 })
    }
    if (!mapping.nome || !mapping.telefone) {
      return NextResponse.json(
        { error: 'Mapeie ao menos as colunas de Nome e Telefone' },
        { status: 400 }
      )
    }

    const churchIds = await resolveScopeChurchIds(user)
    const analyzed = await analyzeRows(rows, mapping, churchIds, { includeMembers, includePipeline })
    const summary = summarize(analyzed.map(r => ({ status: r.matchStatus, decision: r.decision })))

    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('whatsapp_import_batches')
      .insert({
        church_id: user.churchId ?? null,
        owner_user_id: String(user.id),
        filename: filename ?? null,
        mapping,
        total_rows: analyzed.length,
        valid_rows: summary.sendable,
        invalid_rows: summary.invalid,
        duplicate_rows: summary.duplicate,
        member_rows: summary.member,
        pipeline_rows: summary.pipeline,
        new_rows: summary.new,
        status: 'analyzed',
      })
      .select('*')
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: batchErr?.message ?? 'Erro ao salvar o lote' }, { status: 500 })
    }

    const rowsToInsert = analyzed.map(r => ({
      batch_id: batch.id,
      row_number: r.rowNumber,
      raw: r.raw,
      name: r.name || null,
      phone: r.phone,
      email: r.email,
      variables: { ...r.variables, protocolo: String(batch.id).slice(0, 8).toUpperCase() },
      match_status: r.matchStatus,
      matched_member_id: r.matchedMemberId,
      matched_attendance_id: r.matchedAttendanceId,
      matched_stage: r.matchedStage,
      decision: r.decision,
      skip_reason: r.skipReason,
    }))

    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const { error } = await supabaseAdmin
        .from('whatsapp_import_rows')
        .insert(rowsToInsert.slice(i, i + 500))
      if (error) {
        await supabaseAdmin.from('whatsapp_import_batches').delete().eq('id', batch.id)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const { data: saved } = await supabaseAdmin
      .from('whatsapp_import_rows')
      .select('*')
      .eq('batch_id', batch.id)
      .order('row_number', { ascending: true })

    return NextResponse.json({ batch, summary, rows: saved ?? [] }, { status: 201 })
  })
}
