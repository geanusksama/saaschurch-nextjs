import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SLOTS = ['dirigente', 'tesCongreg', 'tesSede'] as const
type Slot = typeof SLOTS[number]

// Nível campo (campo/admin/master) pode assinar a Sede e remover qualquer assinatura.
function isCampoLevel(profileType?: string) {
  return ['master', 'admin', 'campo'].includes(profileType || '')
}

// GET /api/contabilidade/assinaturas?churchId=&inicio=&fim=
// Retorna { dirigente, tesCongreg, tesSede } (imagem + metadados) do relatório.
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const url = new URL(req.url)
    const churchId = url.searchParams.get('churchId')
    const inicio = url.searchParams.get('inicio')
    const fim = url.searchParams.get('fim')
    if (!churchId || !inicio || !fim) {
      return NextResponse.json({ error: 'churchId, inicio e fim são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('contabilidade_relatorio_assinaturas')
      .select('slot, imagem, assinado_por, profile_type')
      .eq('church_id', churchId)
      .eq('periodo_inicio', inicio)
      .eq('periodo_fim', fim)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const assinaturas: Record<string, { imagem: string; assinadoPor: string | null } | null> = {
      dirigente: null, tesCongreg: null, tesSede: null,
    }
    for (const row of data ?? []) {
      assinaturas[row.slot] = { imagem: row.imagem, assinadoPor: row.assinado_por ?? null }
    }
    return NextResponse.json({ assinaturas })
  })
}

// PUT /api/contabilidade/assinaturas — grava/atualiza uma assinatura de um slot.
// Body: { churchId, inicio, fim, slot, imagem }
export async function PUT(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { churchId, inicio, fim, slot, imagem } = body as { churchId?: string; inicio?: string; fim?: string; slot?: Slot; imagem?: string }

    if (!churchId || !inicio || !fim || !slot || !imagem) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }
    if (!SLOTS.includes(slot)) {
      return NextResponse.json({ error: 'Slot inválido' }, { status: 400 })
    }
    // Assinar a Sede exige nível campo.
    if (slot === 'tesSede' && !isCampoLevel(user.profileType)) {
      return NextResponse.json({ error: 'Somente nível campo pode assinar a Sede.' }, { status: 403 })
    }

    // Se já existe e o usuário não pode remover, não pode sobrescrever (protegida).
    const { data: existente } = await supabaseAdmin
      .from('contabilidade_relatorio_assinaturas')
      .select('id')
      .eq('church_id', churchId).eq('periodo_inicio', inicio).eq('periodo_fim', fim).eq('slot', slot)
      .maybeSingle()

    if (existente && !isCampoLevel(user.profileType)) {
      return NextResponse.json({ error: 'Assinatura já registrada — somente nível campo pode alterar.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('contabilidade_relatorio_assinaturas')
      .upsert({
        church_id: churchId,
        periodo_inicio: inicio,
        periodo_fim: fim,
        slot,
        imagem,
        assinado_por: user.fullName || user.email || null,
        assinado_por_id: user.id || user.sub || null,
        profile_type: user.profileType || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'church_id,periodo_inicio,periodo_fim,slot' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  })
}

// DELETE /api/contabilidade/assinaturas?churchId=&inicio=&fim=&slot=
// Remove uma assinatura — SOMENTE nível campo.
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!isCampoLevel(user.profileType)) {
      return NextResponse.json({ error: 'Somente nível campo pode remover assinaturas.' }, { status: 403 })
    }
    const url = new URL(req.url)
    const churchId = url.searchParams.get('churchId')
    const inicio = url.searchParams.get('inicio')
    const fim = url.searchParams.get('fim')
    const slot = url.searchParams.get('slot')
    if (!churchId || !inicio || !fim || !slot) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('contabilidade_relatorio_assinaturas')
      .delete()
      .eq('church_id', churchId).eq('periodo_inicio', inicio).eq('periodo_fim', fim).eq('slot', slot)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  })
}
