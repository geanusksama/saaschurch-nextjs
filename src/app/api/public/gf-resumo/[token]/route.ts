import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildGfContactReport } from '@/lib/gfContactReportService'

/**
 * Resumo do liderado — rota SEM autenticação.
 *
 * O líder recebe este link no WhatsApp assim que alguém entra no GF dele. O
 * token é a única chave de acesso, então a rota só devolve dados daquele
 * contato específico: nada de listar o GF inteiro nem o cadastro da igreja.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const { data: share } = await supabaseAdmin
    .from('cell_group_share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!share) {
    return NextResponse.json({ error: 'Link não encontrado ou expirado.' }, { status: 404 })
  }

  const cell = await prisma.cellGroup.findUnique({
    where: { id: share.cell_group_id },
    select: {
      name: true,
      color: true,
      churchId: true,
      leader: { select: { fullName: true } },
      church: { select: { name: true, regional: { select: { campoId: true } } } },
    },
  })

  const report = await buildGfContactReport({
    name: share.contact_name ?? '',
    phone: share.contact_phone,
    campoId: cell?.church?.regional?.campoId ?? null,
    memberId: share.member_id,
    importRowId: share.import_row_id,
    // Quem abre o link é o líder, que não tem sessão. O token já é o crachá:
    // ele foi emitido para ESTE contato, então não há escopo de instância a
    // aplicar — a conversa que interessa é a dele.
    instanceIds: null,
  }).catch((err) => {
    console.error('[GET /api/public/gf-resumo/[token]] falha ao montar o parecer', err)
    return null
  })

  return NextResponse.json({
    cellGroup: { name: cell?.name ?? null, color: cell?.color ?? null, leaderName: cell?.leader?.fullName ?? null },
    churchName: cell?.church?.name ?? null,
    contact: { name: share.contact_name, phone: share.contact_phone },
    report,
  })
}
