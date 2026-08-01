import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'
import { buildGfContactReport } from '@/lib/gfContactReportService'
import { generateGfContactReportPdf, type GfContactPdfEntry } from '@/lib/pdfGenerator'

/**
 * POST /api/whatsapp/imports/report — parecer de consolidação em PDF.
 *
 * Body: { contatos: [{ nome, telefone, memberId?, importRowId? }], titulo? }
 *
 * Serve qualquer fonte da tela de Envio em Massa (membros, pipeline ou lista
 * importada): o que amarra o parecer é o TELEFONE, porque é por ele que se
 * acha a conversa. `memberId`/`importRowId`, quando vêm, dizem em que GF a
 * pessoa está.
 *
 * A conversa só é lida nas instâncias que o usuário enxerga — senão bastaria
 * mandar um telefone qualquer para ler o atendimento de outra igreja.
 *
 * Cada contato é uma chamada de IA, então o lote é processado em série e com
 * teto: acima disso a rota estoura o timeout da plataforma.
 */

const MAX_CONTACTS = 40

interface ContatoEntrada {
  nome?: string
  telefone?: string
  memberId?: string | null
  importRowId?: string | null
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const contatos: ContatoEntrada[] = Array.isArray(body.contatos) ? body.contatos : []

    const validos = contatos.filter((c) => String(c.telefone ?? '').replace(/\D/g, '').length >= 10)
    if (!validos.length) {
      return NextResponse.json({ error: 'Selecione ao menos um contato com telefone.' }, { status: 400 })
    }
    if (validos.length > MAX_CONTACTS) {
      return NextResponse.json(
        { error: `Selecione até ${MAX_CONTACTS} contatos por relatório.` },
        { status: 400 }
      )
    }

    const instanceIds = await getAccessibleInstanceIds(String(user.id), user.profileType)

    const entries: GfContactPdfEntry[] = []
    for (const c of validos) {
      const report = await buildGfContactReport({
        name: c.nome ?? '',
        phone: String(c.telefone),
        campoId: user.campoId ?? null,
        memberId: c.memberId ?? null,
        importRowId: c.importRowId ?? null,
        instanceIds,
      }).catch((err) => {
        console.error('[imports/report] falha no parecer de', c.telefone, err)
        return null
      })

      if (!report) continue

      entries.push({
        nome: report.nome,
        telefone: report.telefone,
        situacao: report.situacao.cellGroupName
          ? `No GF ${report.situacao.cellGroupName}${
              report.situacao.leaderName ? ` — líder ${report.situacao.leaderName}` : ''
            }.`
          : 'Sem GF e sem líder designado.',
        sintese: report.sintese,
        pontosPositivos: report.pontosPositivos,
        pontosNegativos: report.pontosNegativos,
        tentativasSemResposta: report.fatos.tentativasSemResposta,
        respondeu: report.fatos.respondeu,
        totalMensagens: report.fatos.totalMessages,
        linksEnviados: report.fatos.linksEnviados,
        enviouEndereco: report.enviouEndereco,
        sugestaoMelhoria: report.sugestaoMelhoria,
        motivoSemGf: report.motivoSemGf,
      })
    }

    if (!entries.length) {
      return NextResponse.json({ error: 'Não foi possível gerar o parecer dos contatos.' }, { status: 502 })
    }

    const pdf = generateGfContactReportPdf(
      'Parecer de Consolidação',
      `${String(body.titulo ?? 'Envio em Massa')} · ${entries.length} contato(s)`,
      entries
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="parecer-consolidacao.pdf"',
      },
    })
  })
}
