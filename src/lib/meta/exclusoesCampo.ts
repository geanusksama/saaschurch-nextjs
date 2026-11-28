/**
 * "SAIR" vale para os dois caminhos do campo: quem pediu para sair pelo número oficial
 * (tabela meta_whatsapp_exclusoes, por campo) também é pulado nas campanhas e
 * cronogramas da Z-API do MESMO campo.
 *
 * Campo da instância Z-API = o do agente de recepção dela (instanciasComCampo). Sem agente
 * ⇒ campo indefinido ⇒ não consulta exclusões (comportamento de antes).
 * Comparação pelos últimos 8 dígitos (como pastoralDuplicateCheck), pois a Z-API e a Meta
 * guardam o telefone em formatos diferentes (com/sem 55, com/sem o 9).
 */

export const MOTIVO_PEDIU_PARA_SAIR = 'Pediu para sair: número na lista de exclusão.'

export function ultimos8(telefone: string): string {
  return String(telefone ?? '').replace(/\D/g, '').slice(-8)
}

export type LerExclusoes = (campoId: string, ultimos8Digitos: string[]) => Promise<string[]>

/** Uma consulta só, limitada aos telefones pedidos. Devolve os telefones gravados (qualquer formato). */
async function lerExclusoesDoBanco(campoId: string, tails: string[]): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')
  const l = await prisma.$queryRaw<Array<{ telefone: string }>>`
    SELECT telefone FROM meta_whatsapp_exclusoes
    WHERE campo_id = ${campoId}::uuid
      AND right(regexp_replace(telefone, '[^0-9]', '', 'g'), 8) = ANY(${tails}::text[])
    LIMIT 1000`
  return l.map(x => x.telefone)
}

/** Conjunto dos ÚLTIMOS 8 DÍGITOS excluídos no campo, entre os telefones dados. */
export async function telefonesExcluidosPorFinal8(
  campoId: string,
  telefones: string[],
  ler: LerExclusoes = lerExclusoesDoBanco
): Promise<Set<string>> {
  const tails = [...new Set(telefones.map(ultimos8).filter(t => t.length === 8))]
  if (!tails.length) return new Set()
  const gravados = await ler(campoId, tails)
  const pedidos = new Set(tails)
  return new Set(gravados.map(ultimos8).filter(t => pedidos.has(t)))
}

export interface DepsSairZapi {
  /** campo da instância Z-API (agente de recepção); null = indefinido */
  campoDaInstancia: (instanciaId: string) => Promise<string | null>
  lerExclusoes?: LerExclusoes
}

async function campoDaInstanciaDoBanco(instanciaId: string): Promise<string | null> {
  const { instanciasComCampo } = await import('@/lib/whatsappCampo')
  const [i] = await instanciasComCampo(new Set([instanciaId]))
  return i?.campoId ?? null
}

const CODIGOS_SEM_TABELA = new Set(['P2021', 'P2022', '42P01', '42703'])

/** Tabela/coluna que não existe (Prisma P2021/P2022 ou Postgres 42P01/42703), no erro ou aninhado em meta/cause. */
export function ehErroDeTabelaAusente(err: unknown, nivel = 0): boolean {
  if (!err || typeof err !== 'object' || nivel > 4) return false
  const e = err as { code?: unknown; meta?: unknown; cause?: unknown }
  if (typeof e.code === 'string' && CODIGOS_SEM_TABELA.has(e.code)) return true
  return ehErroDeTabelaAusente(e.meta, nivel + 1) || ehErroDeTabelaAusente(e.cause, nivel + 1)
}

export const MSG_LISTA_SAIR_INDISPONIVEL =
  'Não foi possível conferir a lista de quem pediu para sair; os envios da Z-API deste campo estão aguardando.'

export interface DepsConferirSair extends DepsSairZapi {
  /** grava o alerta envio_pausado (uma vez por campo por dia) */
  alertar?: (campoId: string, chave: string, mensagem: string) => Promise<void>
  /** log de "sem a tabela" (uma vez por processo) */
  avisarSemTabela?: (err: unknown) => void
}

let avisouSemTabela = false
const depsPadrao: DepsConferirSair = {
  campoDaInstancia: campoDaInstanciaDoBanco,
  alertar: async (campoId, chave, mensagem) => {
    const { alertarEnvioPausadoUmaVez } = await import('@/lib/meta/depsJornada')
    await alertarEnvioPausadoUmaVez(campoId, chave, mensagem, true)
  },
  avisarSemTabela: err => {
    if (avisouSemTabela) return
    avisouSemTabela = true
    console.error('[sair] tabela meta_whatsapp_exclusoes ausente: seguindo sem exclusões', err)
  },
}

export type ConferenciaSair =
  | { tipo: 'ok'; excluidos: Set<string> }
  | { tipo: 'aguardar' }

/**
 * Confere quem pediu para sair antes de enviar pela Z-API.
 * - sem campo: nada a conferir;
 * - tabela/coluna ausente: fail-open (sem exclusões), log uma vez por processo;
 * - outro erro: 'aguardar' (não envia) + alerta envio_pausado uma vez por campo por dia.
 * `campoConhecido` evita buscar o campo quando o objeto da instância já o traz.
 */
export async function conferirSairZapi(
  instanciaId: string,
  telefones: string[],
  deps: DepsConferirSair = depsPadrao,
  campoConhecido?: string | null
): Promise<ConferenciaSair> {
  let campoId: string | null = campoConhecido ?? null
  try {
    if (!campoId) campoId = await deps.campoDaInstancia(instanciaId)
    if (!campoId) return { tipo: 'ok', excluidos: new Set() }
    return { tipo: 'ok', excluidos: await telefonesExcluidosPorFinal8(campoId, telefones, deps.lerExclusoes) }
  } catch (err) {
    if (ehErroDeTabelaAusente(err)) {
      deps.avisarSemTabela?.(err)
      return { tipo: 'ok', excluidos: new Set() }
    }
    console.error('[sair] falha ao conferir a lista de exclusões', err)
    if (campoId && deps.alertar) {
      const dia = new Date().toISOString().slice(0, 10)
      try {
        await deps.alertar(campoId, `[lista-sair ${dia}]`, `${MSG_LISTA_SAIR_INDISPONIVEL} [lista-sair ${dia}]`)
      } catch (e) {
        console.error('[sair] alerta', e)
      }
    }
    return { tipo: 'aguardar' }
  }
}
