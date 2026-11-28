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
      AND right(regexp_replace(telefone, '\D', '', 'g'), 8) = ANY(${tails}::text[])
    LIMIT 1000`
  return l.map(x => x.telefone)
}

/** Conjunto dos ÚLTIMOS 8 DÍGITOS excluídos no campo, entre os telefones dados. */
export async function telefonesExcluidos(
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

/**
 * Últimos 8 dígitos (entre os telefones dados) que pediram para sair no campo desta instância Z-API.
 * Instância sem campo ⇒ conjunto vazio, sem consultar exclusões.
 */
export async function excluidosDaInstanciaZapi(
  instanciaId: string,
  telefones: string[],
  deps: DepsSairZapi = { campoDaInstancia: campoDaInstanciaDoBanco }
): Promise<Set<string>> {
  const campoId = await deps.campoDaInstancia(instanciaId)
  if (!campoId) return new Set()
  return telefonesExcluidos(campoId, telefones, deps.lerExclusoes)
}
