/**
 * GET /api/pastoral/distribuicao?batchId=&limite=
 *
 * Pares "pessoa → GF sugerido" que já foram analisados e ainda esperam o
 * clique em Conectar. Não roda análise nenhuma: é a leitura do que ficou
 * gravado, para a tela abrir instantânea.
 *
 * Também devolve os GFs candidatos, para a tela poder trocar a sugestão por
 * outro grupo quando quem está olhando discordar da distância.
 *
 * `conectados=1` inverte a lista: em vez de quem espera, mostra quem já foi
 * conectado — é o que permite desfazer em lote.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { listarParesPendentes, listarGfsCandidatos } from '@/lib/gfDistribuicaoService'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get('batchId')
    const limite = Number(searchParams.get('limite') ?? '100')

    const churchId = searchParams.get('churchId') || user.churchId || null

    const [pares, gfs] = await Promise.all([
      listarParesPendentes({
        batchId,
        churchId,
        limite: Number.isFinite(limite) ? limite : 100,
        conectados: searchParams.get('conectados') === '1',
      }),
      listarGfsCandidatos(churchId),
    ])

    return NextResponse.json({ pares, gfs })
  })
}
