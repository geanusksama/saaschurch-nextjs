import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import {
  CSV_HEADER,
  adquirirTravaGeracao,
  buscarLancamentosEmBlocos,
  contarLancamentos,
  findAcessoById,
  liberarTravaGeracao,
} from '@/lib/contabilidadeService'

export const maxDuration = 300

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Gera o CSV contabil do periodo. Responde em NDJSON (streaming) para que a
 * tela mostre o percentual — uma busca de um ano inteiro demora.
 *
 * Eventos:
 *   {"type":"start","total":N}
 *   {"type":"progress","loaded":N,"total":N,"percent":0-100}
 *   {"type":"done","filename":"...","csv":"..."}
 *   {"type":"error","error":"..."}
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { session_token, data_inicio, data_fim } = body as {
    session_token?: string
    data_inicio?: string
    data_fim?: string
  }

  if (!session_token) {
    return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })
  }

  const payload = verifyToken<{ acesso_id: string; campo: string; scope: string }>(session_token)
  if (!payload || payload.scope !== 'contabilidade') {
    return NextResponse.json({ error: 'Sessao expirada. Faca o acesso novamente.' }, { status: 401 })
  }

  if (!data_inicio || !data_fim || !ISO_DATE.test(data_inicio) || !ISO_DATE.test(data_fim)) {
    return NextResponse.json({ error: 'Informe o periodo (data inicial e final).' }, { status: 400 })
  }

  if (data_inicio > data_fim) {
    return NextResponse.json({ error: 'A data inicial nao pode ser maior que a final.' }, { status: 400 })
  }

  const acesso = await findAcessoById(payload.acesso_id)
  if (!acesso) {
    return NextResponse.json({ error: 'Acesso nao encontrado.' }, { status: 404 })
  }
  if (!acesso.ativo) {
    return NextResponse.json({ error: 'Acesso bloqueado.', blocked: true }, { status: 403 })
  }

  // Trava: nunca duas geracoes simultaneas do mesmo acesso
  const travou = await adquirirTravaGeracao(acesso)
  if (!travou) {
    return NextResponse.json(
      { error: 'Ja existe uma geracao em andamento para este acesso. Aguarde a conclusao.' },
      { status: 409 }
    )
  }

  const encoder = new TextEncoder()
  const campo = acesso.campo
  const acessoId = acesso.id

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        const total = await contarLancamentos(campo, data_inicio, data_fim)
        send({ type: 'start', total })

        const linhas: string[] = [CSV_HEADER]
        let loaded = 0

        for await (const bloco of buscarLancamentosEmBlocos(campo, data_inicio, data_fim)) {
          linhas.push(...bloco)
          loaded += bloco.length
          send({
            type: 'progress',
            loaded,
            total,
            percent: total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 100,
          })
        }

        send({
          type: 'done',
          total: loaded,
          percent: 100,
          filename: `contabilidade_${campo}_${data_inicio}_a_${data_fim}.csv`,
          csv: linhas.join('\n'),
        })
      } catch (err) {
        console.error('[contabilidade/relatorio]', err)
        send({ type: 'error', error: 'Falha ao gerar o relatorio. Tente novamente.' })
      } finally {
        await liberarTravaGeracao(acessoId).catch(() => {})
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
