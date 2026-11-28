/**
 * Envio de uma etapa de jornada (cronograma pastoral). Z-API: exatamente como antes (o remetente
 * é injetado e recebe os mesmos argumentos). Número oficial (Meta): só modelo aprovado, reaproveitando
 * enviarModeloDaCampanha (exclusões, limite diário, códigos de parada). Sem Next/Prisma para testar.
 *
 * Variáveis do modelo, preenchidas sozinhas pelo TIPO que cada uma declara: nome => primeiro nome da
 * pessoa, igreja => nome da igreja, data => data do envio (DD/MM/AAAA, Brasília). Modelo com variável
 * "livre" não serve para jornada (não há de onde tirar o texto).
 */
import { enviarModeloDaCampanha, type DepsCampanhaOficial, type MapaVariaveis, type ResultadoEnvioOficial } from './campanhaOficial.ts'

type VariavelBruta = { posicao?: unknown; tipo?: unknown }

function lista(variaveis: unknown): VariavelBruta[] {
  return Array.isArray(variaveis) ? (variaveis as VariavelBruta[]) : []
}

/** O modelo pode ser escolhido numa etapa? Todas as variáveis precisam ser nome, igreja ou data. */
export function modeloServeParaJornada(variaveis: unknown): boolean {
  return lista(variaveis).every((v) => v.tipo === 'nome' || v.tipo === 'igreja' || v.tipo === 'data')
}

/** Mapa de variáveis (posição => fonte) do modelo, para parametrosDaMensagem. */
export function variaveisDaJornada(variaveis: unknown, dataDoEnvio: string): MapaVariaveis {
  const mapa: MapaVariaveis = {}
  for (const v of lista(variaveis)) {
    const pos = String(v.posicao)
    mapa[pos] = v.tipo === 'nome' ? 'nome' : v.tipo === 'igreja' ? 'igreja' : { fixo: dataDoEnvio }
  }
  return mapa
}

/** DD/MM/AAAA no horário de Brasília. */
export function dataBrasilia(agora: Date): string {
  const b = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(b.getUTCDate())}/${p(b.getUTCMonth() + 1)}/${b.getUTCFullYear()}`
}

export type ResultadoZapiJornada = { status: 'sent' | 'error'; messageId?: string; error?: string }

export type DepsEtapa = {
  /** Mesmos argumentos de antes: imagem (se houver) ou texto com "digitando...". */
  enviarZapi(instancia: EntradaEtapa['instancia'], phone: string, message: string, imageUrl: string | null, delayTyping: number): Promise<ResultadoZapiJornada>
  oficial: DepsCampanhaOficial
}

export type EntradaEtapa = {
  instancia: { id: string; provider?: string | null; campo_id?: string | null }
  phone: string
  name: string | null
  message: string
  imageUrl: string | null
  delayTyping: number
  modeloId: string | null
  /** Campo da igreja dona da jornada (igreja -> regional -> campo). */
  campoDaJornada: string | null
  igrejaNome: string
  agora: Date
}

export type ResultadoEtapa =
  | { tipo: 'zapi'; result: ResultadoZapiJornada }
  | ResultadoEnvioOficial

export const MSG_ETAPA_SEM_MODELO = 'etapa sem modelo: escolha um modelo aprovado para enviar pelo WhatsApp oficial'

export async function enviarEtapaDaJornada(deps: DepsEtapa, e: EntradaEtapa): Promise<ResultadoEtapa> {
  if (e.instancia.provider !== 'meta') {
    return { tipo: 'zapi', result: await deps.enviarZapi(e.instancia, e.phone, e.message, e.imageUrl, e.delayTyping) }
  }
  // Número oficial: nunca texto livre.
  const campoId = e.instancia.campo_id ?? null
  if (!campoId || e.campoDaJornada !== campoId) {
    return { tipo: 'erro', mensagem: 'O número oficial pertence a outro campo.' }
  }
  if (!e.modeloId) return { tipo: 'erro', mensagem: MSG_ETAPA_SEM_MODELO }
  const modelo = await deps.oficial.modelo(campoId, e.modeloId)
  if (!modelo) return { tipo: 'erro', mensagem: 'modelo não encontrado neste campo' }
  if (!modeloServeParaJornada(modelo.variaveis)) {
    return { tipo: 'erro', mensagem: 'modelo com variável de texto livre não serve para jornada' }
  }
  return enviarModeloDaCampanha(deps.oficial, {
    campoId,
    instanciaId: e.instancia.id,
    modeloId: e.modeloId,
    variaveis: variaveisDaJornada(modelo.variaveis, dataBrasilia(e.agora)),
    destinatario: { name: e.name, phone: e.phone, variables: {} },
    igrejaNome: e.igrejaNome,
  })
}
