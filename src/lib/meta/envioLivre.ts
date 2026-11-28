/**
 * Envio livre (texto, imagem, áudio, documento) pelo número oficial da Meta, dentro da
 * janela de atendimento de 24 h (contada da última mensagem RECEBIDA do contato).
 * Dependências injetadas (conexão, janela, Graph, relógio) para testar sem banco nem rede.
 * Nunca devolve nem registra o token.
 */
import type { Graph } from './graph.ts'

export type ConteudoLivre = {
  tipo: 'texto' | 'imagem' | 'audio' | 'documento'
  texto?: string
  url?: string
  nomeArquivo?: string
}

export type ResultadoEnvioLivre = { messageId: string; status: 'sent' | 'error'; error?: string }

export type DepsEnvioLivre = {
  /** Número e token (já decifrado) da conexão ligada à instância espelho; null se não houver/desconectada. */
  obterConexao: (instanciaId: string) => Promise<{ phoneNumberId: string; token: string } | null>
  /** Data da última mensagem recebida (inbound) do telefone nessa instância; null se nunca. */
  ultimaRecebidaEm: (instanciaId: string, telefone: string) => Promise<Date | null>
  graph: Graph
  agora?: () => Date
}

export const JANELA_MS = 24 * 60 * 60 * 1000

/** 24 h exatas: dentro enquanto agora - última <= 24 h. */
export function dentroDaJanela(ultimaRecebidaEm: Date | null, agora: Date): boolean {
  if (!ultimaRecebidaEm) return false
  const diff = agora.getTime() - ultimaRecebidaEm.getTime()
  // Data futura (relógio fora de hora entre servidores): conta como dentro da janela.
  return diff >= 0 ? diff <= JANELA_MS : true
}

const ehUrl = (s: string | undefined): s is string => !!s && /^https?:\/\//i.test(s)

export function montarCorpoLivre(para: string, c: ConteudoLivre): Record<string, unknown> | { erro: string } {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: para }
  switch (c.tipo) {
    case 'texto':
      if (!c.texto) return { erro: 'texto_vazio' }
      return { ...base, type: 'text', text: { body: c.texto, preview_url: false } }
    case 'imagem':
      if (!ehUrl(c.url)) return { erro: 'formato_nao_suportado_meta' }
      return { ...base, type: 'image', image: { link: c.url, ...(c.texto ? { caption: c.texto } : {}) } }
    case 'audio':
      if (!ehUrl(c.url)) return { erro: 'formato_nao_suportado_meta' }
      return { ...base, type: 'audio', audio: { link: c.url } }
    case 'documento':
      if (!ehUrl(c.url)) return { erro: 'formato_nao_suportado_meta' }
      return {
        ...base, type: 'document',
        document: { link: c.url, ...(c.texto ? { caption: c.texto } : {}), ...(c.nomeArquivo ? { filename: c.nomeArquivo } : {}) },
      }
    default:
      return { erro: 'tipo_invalido' }
  }
}

export async function enviarLivreMeta(
  deps: DepsEnvioLivre,
  instancia: { id: string },
  para: string,
  conteudo: ConteudoLivre,
): Promise<ResultadoEnvioLivre> {
  const falha = (error: string): ResultadoEnvioLivre => ({ messageId: '', status: 'error', error })
  try {
    const telefone = (para || '').replace(/\D/g, '')
    if (!telefone) return falha('telefone_invalido')
    const corpo = montarCorpoLivre(telefone, conteudo)
    if ('erro' in corpo) return falha(String(corpo.erro))

    const agora = (deps.agora ?? (() => new Date()))()
    const ultima = await deps.ultimaRecebidaEm(instancia.id, telefone)
    if (!dentroDaJanela(ultima, agora)) return falha('fora_da_janela_24h')

    const conexao = await deps.obterConexao(instancia.id)
    if (!conexao) return falha('conexao_meta_indisponivel')

    const resp = await deps.graph.post(`${conexao.phoneNumberId}/messages`, corpo, conexao.token)
    const wamid = resp?.messages?.[0]?.id
    if (!wamid) return falha('Meta não devolveu o id da mensagem')
    return { messageId: String(wamid), status: 'sent' }
  } catch (e) {
    return falha(e instanceof Error ? e.message : 'erro ao enviar pela Meta')
  }
}

/** Só o espelho do número oficial vai pela Meta; qualquer outra (inclusive sem `provider`) segue Z-API. */
export function ehInstanciaMeta(i: { provider?: string | null }): boolean {
  return i.provider === 'meta'
}

/**
 * Variantes do telefone brasileiro com e sem o 9 de celular após o DDD (a Meta pode entregar
 * o número sem ele). 55+DDD+9+8 dígitos (13) => [13, 12]; 55+DDD+8 dígitos (12) => [12, 13].
 * Qualquer outro formato volta como está.
 */
export function variantesTelefoneBR(digitos: string): string[] {
  const d = (digitos || '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') return [d, d.slice(0, 4) + d.slice(5)]
  if (d.length === 12 && d.startsWith('55') && /^[6-9]/.test(d.slice(4))) return [d, d.slice(0, 4) + '9' + d.slice(4)]
  return [d]
}
