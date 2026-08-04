/**
 * GET /api/membro/conteudo?token=<member_token>&modulo=<nome>
 *
 * Conteúdo dos módulos do portal: pao, pregacoes, agenda, lideranca, igreja.
 * O campo vem do membro assinado no token — a pessoa só vê o conteúdo do
 * próprio campo, nunca o de outro.
 *
 * Uma rota só para todos os módulos porque a autenticação e a resolução de
 * campo são idênticas; o que muda é só a consulta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import {
  getCampoDoMembro, getPaoDiario, getPregacoes,
  getAgenda, getLideranca, getIgreja, getFeed,
  getMinisterios, getIngressos,
} from '@/lib/membroConteudoService'

const MODULOS = ['pao', 'pregacoes', 'agenda', 'lideranca', 'igreja', 'feed', 'ministerios', 'compras'] as const
type Modulo = typeof MODULOS[number]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const modulo = searchParams.get('modulo') as Modulo | null

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }
    if (!modulo || !MODULOS.includes(modulo)) {
      return NextResponse.json(
        { error: `Módulo inválido. Use um de: ${MODULOS.join(', ')}.` },
        { status: 400 },
      )
    }

    const payload = verifyToken<{ sub: string }>(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
    }

    const campoId = await getCampoDoMembro(payload.sub)
    if (!campoId) {
      // Sem campo não há isolamento possível — devolver tudo seria vazamento.
      return NextResponse.json({ itens: [], semCampo: true })
    }

    switch (modulo) {
      case 'pao':       return NextResponse.json({ itens: await getPaoDiario(campoId) })
      case 'pregacoes': return NextResponse.json({ itens: await getPregacoes(campoId) })
      case 'agenda':    return NextResponse.json({ itens: await getAgenda(campoId) })
      case 'lideranca': return NextResponse.json({ itens: await getLideranca(campoId) })
      case 'igreja':    return NextResponse.json({ igreja: await getIgreja(campoId) })
      case 'feed':      return NextResponse.json({ itens: await getFeed(campoId) })
      case 'ministerios': return NextResponse.json({ itens: await getMinisterios(campoId) })
      // compras precisa do id do membro além do campo: os ingressos são dele
      case 'compras':   return NextResponse.json({ itens: await getIngressos(payload.sub, campoId) })
    }
  } catch (err) {
    console.error('[membro/conteudo]', (err as Error)?.message)
    return NextResponse.json({ error: 'Não foi possível carregar o conteúdo.' }, { status: 500 })
  }
}
