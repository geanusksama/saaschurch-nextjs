/**
 * Envio em Massa pelo número oficial (Meta): só modelo aprovado. Regras puras de validação
 * e de parâmetros, mais o envio de UM destinatário com dependências injetadas (sem banco,
 * sem Next), para testar sem rede. A fila, a conversa e a pausa ficam no tick da campanha.
 */
import {
  montarParametros, montarMensagemTemplate, normalizarTelefoneBR,
  CODIGOS_PARAR_DISPARO, CODIGOS_PARAR_MODELO, CODIGO_LIMITE_SPAM, CODIGOS_LIMITE_CHAMADAS,
} from './envio.ts'
import { limiteDoNivel, MOTIVO_CODIGO, MSG_QUALIDADE_RED, MSG_SEM_CONEXAO_ENVIO } from './servicoEnvio.ts'
import type { VariavelModelo } from './modelos.ts'

/** De onde vem o valor de cada variável do modelo: nome da pessoa, nome da igreja ou texto fixo. */
export type FonteVariavel = 'nome' | 'igreja' | { fixo: string }
export type MapaVariaveis = Record<string, FonteVariavel>

const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function fonteValida(v: unknown): v is FonteVariavel {
  if (v === 'nome' || v === 'igreja') return true
  return ehObj(v) && typeof v.fixo === 'string' && v.fixo.trim().length > 0 && v.fixo.length <= 200
}

export function validarCampanhaOficial(entrada: {
  instancias: Array<{ provider: string; campo_id: string | null }>
  campoAtivo: string
  modelo: { status: string; campoId: string; variaveis?: Array<{ posicao: number }> } | null
  variaveis: Record<string, unknown>
}): { ok: true } | { ok: false; erro: string } {
  const oficiais = entrada.instancias.filter((i) => i.provider === 'meta')
  if (!oficiais.length) return { ok: true } // campanha Z-API: nada a validar aqui
  if (oficiais.length !== entrada.instancias.length) {
    return { ok: false, erro: 'Não é possível misturar o número oficial com instâncias Z-API na mesma campanha. Escolha só o número oficial.' }
  }
  if (oficiais.some((i) => i.campo_id !== entrada.campoAtivo)) {
    return { ok: false, erro: 'O número oficial selecionado pertence a outro campo.' }
  }
  const m = entrada.modelo
  if (!m) return { ok: false, erro: 'Escolha um modelo aprovado para enviar pelo WhatsApp oficial.' }
  if (m.campoId !== entrada.campoAtivo) return { ok: false, erro: 'Este modelo pertence a outro campo.' }
  if (m.status !== 'APPROVED') return { ok: false, erro: 'Este modelo ainda não foi aprovado pela Meta. Escolha um modelo aprovado.' }
  for (const v of m.variaveis ?? []) {
    if (!fonteValida(entrada.variaveis?.[String(v.posicao)])) {
      return { ok: false, erro: `Preencha a variável {{${v.posicao}}} do modelo.` }
    }
  }
  return { ok: true }
}

/** Só as posições do próprio modelo: chaves extras vindas do cliente não vão para o banco. */
export function variaveisDoModelo(
  variaveis: Record<string, unknown>, posicoes: Array<{ posicao: number }>,
): Record<string, unknown> {
  const saida: Record<string, unknown> = {}
  for (const { posicao } of posicoes) {
    const f = variaveis[String(posicao)]
    saida[String(posicao)] = ehObj(f) ? { fixo: String(f.fixo).trim() } : f
  }
  return saida
}

/**
 * A campanha pode ser vista/controlada neste campo? Campanha Z-API (sem meta_modelo_id) não muda;
 * a oficial só vale no campo do seu número oficial (outro campo ⇒ tratar como 404).
 */
export function campanhaVisivelNoCampo(
  campanha: { meta_modelo_id?: string | null },
  campoDaInstancia: string | null,
  campoAtivo: string | null | undefined,
): boolean {
  if (!campanha.meta_modelo_id) return true
  return !!campoAtivo && !!campoDaInstancia && campoDaInstancia === campoAtivo
}

type Destinatario = { name: string | null; variables: Record<string, string> }

/** Parâmetros do cabeçalho (posição 0) e do corpo (posições >= 1, em ordem), reaproveitando montarParametros. */
export function parametrosDaMensagem(
  metaVariaveis: Record<string, unknown>, destinatario: Destinatario, igrejaNome: string,
): { header?: string[]; body: string[] } {
  const contato = { origem: 'membro' as const, refId: '', nome: destinatario.name ?? '', telefone: '', igrejaNome }
  const posicoes = Object.keys(metaVariaveis).map(Number).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b)
  const header: string[] = []
  const body: string[] = []
  for (const posicao of posicoes) {
    const f = metaVariaveis[String(posicao)]
    const tipo: VariavelModelo['tipo'] = f === 'nome' ? 'nome' : f === 'igreja' ? 'igreja' : 'livre'
    const livre = ehObj(f) && typeof f.fixo === 'string' ? f.fixo : ''
    const p = montarParametros([{ posicao, tipo, exemplo: '' }], contato, { livre })
    ;(posicao === 0 ? header : body).push(...(posicao === 0 ? p.header ?? [] : p.body))
  }
  return header.length ? { header, body } : { body }
}

/** Valores do corpo do modelo, na ordem das posições. */
export function parametrosDoDestinatario(
  metaVariaveis: Record<string, unknown>, destinatario: Destinatario, igrejaNome: string,
): string[] {
  return parametrosDaMensagem(metaVariaveis, destinatario, igrejaNome).body
}

/** Texto do corpo do modelo com {{n}} trocado pelos valores (para guardar na conversa). */
export function textoDoModelo(componentes: unknown, params: { header?: string[]; body: string[] }): string {
  const lista = Array.isArray(componentes) ? componentes : []
  const corpo = lista.find((c) => ehObj(c) && c.type === 'BODY') as { text?: unknown } | undefined
  const texto = typeof corpo?.text === 'string' ? corpo.text : ''
  return texto.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n: string) => params.body[Number(n) - 1] ?? '')
}

export function restanteDoDia(limiteDiario: string | null, usados: number): number {
  return Math.max(0, limiteDoNivel(limiteDiario) - usados)
}

// ---------- envio de um destinatário ----------

export type DepsCampanhaOficial = {
  conexao(campoId: string): Promise<{ phoneNumberId: string; token: string }>
  lerStatus(token: string, phoneNumberId: string): Promise<{ qualidade: string; limiteDiario: string | null }>
  excluido(campoId: string, telefone: string): Promise<boolean>
  modelo(campoId: string, id: string): Promise<{ nome: string; idioma: string; status: string; componentes: unknown; variaveis?: unknown } | null>
  /** Mensagens do número nas últimas 24 h (disparos + campanhas). */
  usadosEm24h(campoId: string, instanciaId: string): Promise<number>
  graph: { post(caminho: string, corpo: unknown, token?: string): Promise<unknown> }
}

export type EntradaEnvioOficial = {
  campoId: string
  instanciaId: string
  modeloId: string
  variaveis: Record<string, unknown>
  destinatario: { name: string | null; phone: string; variables: Record<string, string> }
  igrejaNome: string
}

export type ResultadoEnvioOficial =
  | { tipo: 'enviado'; wamid: string; texto: string }
  | { tipo: 'pulado'; motivo: 'excluido' }
  /** Nada saiu; a campanha para com motivo e o destinatário volta à fila. */
  | { tipo: 'pausar'; motivo: string; codigo?: number }
  /** Nada saiu; o destinatário volta à fila e o tick tenta de novo mais tarde. */
  | { tipo: 'tentar_depois' }
  | { tipo: 'erro'; mensagem: string }

/** Fontes de consumo do número nas últimas 24 h: disparos, campanhas e jornadas somam no mesmo limite da Meta. */
export type ContadoresUso24h = {
  disparos(campoId: string, desde: Date): Promise<number>
  campanhas(instanciaId: string, desde: Date): Promise<number>
  jornadas(instanciaId: string, desde: Date): Promise<number>
}

export function criarUsadosEm24h(c: ContadoresUso24h, agora: () => number = Date.now) {
  return async (campoId: string, instanciaId: string): Promise<number> => {
    const desde = new Date(agora() - 24 * 60 * 60 * 1000)
    const [a, b, j] = await Promise.all([c.disparos(campoId, desde), c.campanhas(instanciaId, desde), c.jornadas(instanciaId, desde)])
    return a + b + j
  }
}

export const MSG_LIMITE_CAMPANHA = 'Limite diário do número atingido. Retome a campanha quando o limite liberar.'

export async function enviarModeloDaCampanha(deps: DepsCampanhaOficial, e: EntradaEnvioOficial): Promise<ResultadoEnvioOficial> {
  const telefone = normalizarTelefoneBR(e.destinatario.phone)
  if (!telefone) return { tipo: 'erro', mensagem: `numero_invalido: ${e.destinatario.phone}` }
  if (await deps.excluido(e.campoId, telefone)) return { tipo: 'pulado', motivo: 'excluido' }

  const modelo = await deps.modelo(e.campoId, e.modeloId)
  if (!modelo || modelo.status !== 'APPROVED') {
    return { tipo: 'pausar', motivo: 'O modelo da campanha não está mais aprovado. Escolha outro modelo e crie uma nova campanha.' }
  }
  const params = parametrosDaMensagem(e.variaveis, e.destinatario, e.igrejaNome)
  if ([...(params.header ?? []), ...params.body].some((v) => !v.trim())) {
    return { tipo: 'erro', mensagem: 'variavel_vazia: falta nome ou valor para preencher o modelo' }
  }

  let con: { phoneNumberId: string; token: string }
  try {
    con = await deps.conexao(e.campoId)
  } catch (err) {
    return { tipo: 'pausar', motivo: err instanceof Error && err.message ? err.message : MSG_SEM_CONEXAO_ENVIO }
  }
  let status: { qualidade: string; limiteDiario: string | null }
  try {
    status = await deps.lerStatus(con.token, con.phoneNumberId)
  } catch {
    return { tipo: 'tentar_depois' }
  }
  if (status.qualidade === 'RED') return { tipo: 'pausar', motivo: MSG_QUALIDADE_RED }
  if (restanteDoDia(status.limiteDiario, await deps.usadosEm24h(e.campoId, e.instanciaId)) <= 0) {
    return { tipo: 'pausar', motivo: MSG_LIMITE_CAMPANHA }
  }

  const corpo = montarMensagemTemplate(telefone, modelo.nome, modelo.idioma, params)
  try {
    const r = await deps.graph.post(`${con.phoneNumberId}/messages`, corpo, con.token)
    const wamid = (r as { messages?: Array<{ id?: unknown }> } | null)?.messages?.[0]?.id
    if (typeof wamid !== 'string' || !wamid) return { tipo: 'erro', mensagem: 'A Meta respondeu sem o id da mensagem.' }
    return { tipo: 'enviado', wamid, texto: textoDoModelo(modelo.componentes, params) }
  } catch (err) {
    const x = err as { name?: string; message?: string; codigo?: number | null }
    const codigo = x?.name === 'ErroGraph' && typeof x.codigo === 'number' ? x.codigo : null
    if (codigo !== null) {
      if ([...CODIGOS_PARAR_DISPARO, ...CODIGOS_PARAR_MODELO, CODIGO_LIMITE_SPAM].includes(codigo)) {
        return { tipo: 'pausar', codigo, motivo: MOTIVO_CODIGO[codigo] ?? `A Meta recusou (${codigo}).` }
      }
      if (codigo === 130429 || CODIGOS_LIMITE_CHAMADAS.includes(codigo)) return { tipo: 'tentar_depois' }
      return { tipo: 'erro', mensagem: String(x.message ?? 'Erro da Meta').slice(0, 300) }
    }
    // Tempo esgotado ou rede: a Meta pode ter enviado; não reenvia.
    return { tipo: 'erro', mensagem: 'A Meta não respondeu a tempo. Não reenviamos para não cobrar duas vezes.' }
  }
}
