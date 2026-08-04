/**
 * POST /api/pastoral/distribuicao/analisar
 *
 * Body: { batchId?, limite?, refazer? }
 *
 * Roda a análise: procura o endereço de cada contato importado (na planilha e,
 * quando não houver, na conversa de WhatsApp via IA), coloca no mapa e escolhe
 * o GF mais próximo. Devolve o resumo do que encontrou e os pares para a tela.
 *
 * NÃO anexa ninguém. A conexão é sempre um clique humano em "Conectar" (que
 * chama POST /api/cell-groups/[id]/members) porque anexar dispara WhatsApp
 * para o líder e passa a cobrar dele o acompanhamento daquela pessoa.
 *
 * O lote é limitado por chamada: cada contato sem endereço na planilha custa
 * uma chamada de IA e uma de geocodificação com espera de 1s (política do
 * Nominatim). A tela chama de novo enquanto `restantes` for maior que zero.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'
import { analisarDistribuicao } from '@/lib/gfDistribuicaoService'

/** Teto por chamada — acima disso a requisição estoura o tempo da plataforma. */
const LIMITE_MAXIMO = 40

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const pedido = Number(body.limite ?? 20)
    const limite = Math.min(LIMITE_MAXIMO, Math.max(1, Number.isFinite(pedido) ? pedido : 20))

    // A conversa só é lida nas instâncias que o usuário enxerga — mesma regra
    // do relatório de contatos, senão daria para ler o atendimento de outra
    // igreja mandando um telefone qualquer.
    const instanceIds = await getAccessibleInstanceIds(String(user.id), user.profileType)

    try {
      const resumo = await analisarDistribuicao({
        batchId: body.batchId ? String(body.batchId) : null,
        churchId: String(body.churchId ?? user.churchId ?? '') || null,
        campoId: user.campoId ?? null,
        instanceIds,
        limite,
        refazer: body.refazer === true,
      })
      return NextResponse.json(resumo)
    } catch (err) {
      console.error('[distribuicao/analisar]', (err as Error)?.message)
      return NextResponse.json(
        { error: (err as Error)?.message || 'Não foi possível concluir a análise.' },
        { status: 500 },
      )
    }
  })
}
