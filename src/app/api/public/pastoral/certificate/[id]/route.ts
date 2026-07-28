import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildCertificatePdf } from '@/lib/pastoralCertificate'
import { JOURNEY_PROFILE_LABELS, type JourneyProfile } from '@/lib/pastoralJourneyDefault'

/**
 * GET /api/public/pastoral/certificate/[id] — Certificado de Acolhimento (PDF).
 *
 * `id` é o enrollment (UUID). Rota pública porque o link vai por WhatsApp para
 * a própria pessoa; o PDF traz nome, período e etapas — nunca telefone.
 * O arquivo é montado a cada acesso, então o link não expira.
 *
 * ?download=1 força o "salvar como" em vez de abrir no visualizador.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const { data: enrollment } = await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .select('id, name, profile, enrolled_at, completed_at, church_id, journey_id')
    .eq('id', id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Certificado não encontrado.' }, { status: 404 })
  }

  const [{ data: church }, { data: sends }] = await Promise.all([
    supabaseAdmin.from('churches').select('name').eq('id', enrollment.church_id).maybeSingle(),
    supabaseAdmin
      .from('pastoral_journey_sends')
      .select('step_id, sent_at, sequence, status')
      .eq('enrollment_id', enrollment.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: true }),
  ])

  const stepIds = Array.from(new Set((sends ?? []).map(s => s.step_id)))
  const { data: steps } = stepIds.length
    ? await supabaseAdmin
        .from('pastoral_journey_steps')
        .select('id, program_label, moment_label')
        .in('id', stepIds)
    : { data: [] }

  const stepById = new Map((steps ?? []).map(s => [s.id, s]))

  const sentAtList = (sends ?? []).map(s => s.sent_at).filter(Boolean) as string[]
  const finishedAt = enrollment.completed_at
    ? new Date(enrollment.completed_at)
    : sentAtList.length
      ? new Date(sentAtList[sentAtList.length - 1])
      : new Date()

  const pdf = buildCertificatePdf({
    personName: enrollment.name ?? 'Irmão(ã) em Cristo',
    churchName: church?.name ?? 'Igreja',
    profileLabel: JOURNEY_PROFILE_LABELS[enrollment.profile as JourneyProfile] ?? enrollment.profile,
    startedAt: new Date(enrollment.enrolled_at),
    finishedAt,
    steps: (sends ?? []).map(s => {
      const step = stepById.get(s.step_id)
      return {
        // a "Programação da Semana" descreve melhor o que foi vivido do que o
        // rótulo do momento ("Semana 2 · Véspera de domingo")
        label: step?.program_label || step?.moment_label || 'Acompanhamento',
        date: s.sent_at ? new Date(s.sent_at) : null,
      }
    }),
  })

  const download = new URL(req.url).searchParams.get('download') === '1'
  const safeName = (enrollment.name ?? 'certificado')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="certificado-${safeName}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
