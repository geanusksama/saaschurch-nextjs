import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateCpf } from '@/lib/membroJwt'

/**
 * Formulário público de adesão ("Quero ser Membro").
 *
 * GET  — devolve o que já foi preenchido, para a pessoa retomar de onde parou.
 * POST — grava os dados e os anexos e marca a solicitação como enviada.
 *
 * O `token` é a credencial: quem tem o link preenche. Não expõe nada além do
 * próprio cadastro, e o POST não aceita mudar status nem igreja de destino —
 * isso é decisão da secretaria na avaliação.
 */

async function loadByToken(token: string) {
  const { data } = await supabaseAdmin
    .from('new_member_requests')
    .select('id, name, whatsapp, status, form_data, documents, form_submitted_at, target_church_id, church_id')
    .eq('form_token', token)
    .maybeSingle()
  return data
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const request = await loadByToken(token)

  if (!request) {
    return NextResponse.json({ error: 'Formulário não encontrado ou link expirado.' }, { status: 404 })
  }

  const churchId = request.target_church_id ?? request.church_id
  const { data: church } = await supabaseAdmin
    .from('churches')
    .select('name')
    .eq('id', churchId)
    .maybeSingle()

  return NextResponse.json({
    id: request.id,
    name: request.name,
    whatsapp: request.whatsapp,
    status: request.status,
    churchName: church?.name ?? null,
    formData: request.form_data ?? null,
    documents: request.documents ?? [],
    submittedAt: request.form_submitted_at,
    // aprovado/reprovado trava a edição: o cadastro já foi decidido
    locked: request.status === 'approved' || request.status === 'rejected',
  })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const request = await loadByToken(token)

  if (!request) {
    return NextResponse.json({ error: 'Formulário não encontrado ou link expirado.' }, { status: 404 })
  }
  if (request.status === 'approved' || request.status === 'rejected') {
    return NextResponse.json(
      { error: 'Esta solicitação já foi avaliada e não pode mais ser alterada.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const form = body.formData ?? {}
  const documents = Array.isArray(body.documents) ? body.documents : []

  // mínimo para a secretaria conseguir avaliar
  const faltando = ['firstName', 'lastName', 'birthDate', 'cpf'].filter(
    k => !String(form[k] ?? '').trim()
  )
  if (faltando.length) {
    return NextResponse.json(
      { error: `Preencha os campos obrigatórios: ${faltando.join(', ')}` },
      { status: 400 }
    )
  }

  // CPF precisa ser válido de verdade: é com ele (+ ROL) que a pessoa entra no
  // Portal do Membro depois de aprovada. CPF inválido = membro que nunca loga.
  if (!validateCpf(String(form.cpf))) {
    return NextResponse.json(
      { error: 'CPF inválido. Confira os números — é com ele que você acessa o Portal do Membro.' },
      { status: 400 }
    )
  }

  const fullName = `${String(form.firstName).trim()} ${String(form.lastName).trim()}`.trim()

  const { error } = await supabaseAdmin
    .from('new_member_requests')
    .update({
      name: fullName,
      form_data: form,
      documents,
      form_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // deixa o rastro no card do pipeline, para a secretaria ver sem abrir a lista
  const { data: reqRow } = await supabaseAdmin
    .from('new_member_requests')
    .select('pipeline_card_id, church_id')
    .eq('id', request.id)
    .maybeSingle()

  if (reqRow?.pipeline_card_id) {
    await supabaseAdmin.from('pastoral_attendance_timeline').insert({
      attendance_id: reqRow.pipeline_card_id,
      church_id: reqRow.church_id,
      event_type: 'form',
      description: 'Formulário de adesão preenchido e enviado para avaliação',
      metadata: { documentos: documents.length },
    })
  }

  return NextResponse.json({ ok: true, name: fullName })
}
