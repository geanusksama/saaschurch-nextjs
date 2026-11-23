/**
 * Envio em massa do WhatsApp Oficial (Meta Cloud API) por campo: público, disparo, fila
 * (cron a cada minuto) e status pelo webhook. Dependências injetadas (repositório,
 * conexões, Graph, cifra, relógio) para testar sem banco nem rede. Nunca devolve token.
 *
 * Regras de parada: qualidade RED, erros de conta/pagamento/token (CODIGOS_PARAR_DISPARO)
 * ⇒ todos os disparos ativos do campo ficam `pausado` com motivo e um alerta em meta_alertas.
 * Erro por pessoa (ex.: 131026) ⇒ só aquele envio falha. Tempo esgotado ⇒ aquele envio
 * falha (não reenviamos para não cobrar duas vezes) e a rodada termina.
 * Nunca reenvia automaticamente o que pode ter saído: depois que o POST começa, o envio
 * só termina como enviado ou falhou — exceto recusa explícita da Meta com código (130429 ou
 * CODIGOS_PARAR_DISPARO), em que nada saiu e o item volta à fila.
 */
import type { Graph } from './graph.ts'
import type { VariavelModelo } from './modelos.ts'
import type { Contato } from './envio.ts'
import {
  normalizarTelefoneBR, ehPedidoDeSair, deduplicarPorTelefone, montarParametros, montarMensagemTemplate,
  tamanhoDoLote, CODIGOS_PARAR_DISPARO,
} from './envio.ts'
import { ErroServico, MSG_TOKEN_RECUSADO } from './servicoConexao.ts'

// ---------- tipos ----------

export type StatusDisparo = 'agendado' | 'enviando' | 'aguardando_limite' | 'pausado' | 'concluido' | 'cancelado'
export type StatusEnvio = 'pendente' | 'enviado' | 'entregue' | 'lido' | 'falhou' | 'ignorado'

export type FiltrosMembros = { igrejaIds: string[]; situacoes: string[]; titulos: string[]; mesAniversario: number | null }
export type FiltrosInteressados = { igrejaIds: string[]; origens: string[]; cadastroDe: string | null; cadastroAte: string | null }
/** `null` = essa origem não entra no público. */
export type FiltrosPublico = { membros: FiltrosMembros | null; interessados: FiltrosInteressados | null }

export type ValoresDisparo = { data?: string; livre?: string }
export type EntradaDisparo = {
  nome: string
  modeloId: string
  filtros: FiltrosPublico
  valores: ValoresDisparo
  agendadoPara: string | null
}

export type Parametros = { header?: string[]; body: string[] }

export type DisparoLinha = {
  id: string
  campoId: string
  modeloNome: string
  idioma: string
  status: string
  motivo: string | null
  agendadoPara: Date | null
  criadoEm: Date
}

export type NovoDisparo = {
  id: string
  campoId: string
  modeloId: string
  modeloNome: string
  idioma: string
  categoria: string
  nome: string
  filtros: FiltrosPublico
  valores: ValoresDisparo
  status: StatusDisparo
  agendadoPara: Date | null
  total: number
  criadoPor: string | null
}

export type NovoEnvio = {
  disparoId: string
  campoId: string
  origem: Contato['origem']
  refId: string
  nome: string
  telefone: string
  parametros: Parametros
}

export type LinhaMembro = { id: string; fullName: string; preferredName: string | null; mobile: string | null; phone: string | null; igrejaNome: string }
export type LinhaInteressado = { id: string; fullName: string; phone: string | null; igrejaNome: string }

export type EventoStatus = { phoneNumberId: string; wamid: string; status: string; erroCodigo?: number | null; erro?: string | null }

export type DepsEnvio = {
  repo: {
    contarPublico(campoId: string, filtros: FiltrosPublico): Promise<{ membros: number; interessados: number }>
    listarContatos(campoId: string, filtros: FiltrosPublico, limite: number): Promise<{ membros: LinhaMembro[]; interessados: LinhaInteressado[] }>
    telefonesExcluidos(campoId: string, telefones: string[]): Promise<Set<string>>
    criarDisparoComEnvios(disparo: NovoDisparo, envios: NovoEnvio[]): Promise<void>
    /** enviando, aguardando_limite e agendado com agendado_para <= agora; mais antigos primeiro. */
    disparosAtivos(campoId: string, agora: Date): Promise<DisparoLinha[]>
    buscarDisparo(campoId: string, id: string): Promise<DisparoLinha | null>
    /** Troca condicionada: só muda se o status atual está em `de`. Devolve se mudou. */
    mudarStatus(id: string, de: string[], para: StatusDisparo, motivo: string | null): Promise<boolean>
    /** Status cancelado + pendentes livres (não reservados) viram ignorado (um comando atômico). */
    cancelar(id: string, de: string[]): Promise<boolean>
    enviadosDesde(campoId: string, desde: Date): Promise<number>
    /** Reserva até `n` pendentes livres (outra execução simultânea não pega os mesmos). A reserva não vence sozinha. */
    reservarPendentes(disparoId: string, n: number): Promise<Array<{ id: string; telefone: string; parametros: unknown }>>
    /** Devolve à fila itens reservados cujo POST não começou (ignorado se o disparo foi cancelado ou o telefone saiu). */
    liberarReserva(ids: string[]): Promise<void>
    /** Reservas com mais de 10 min viram falhou "não confirmado"; devolve os disparos afetados. */
    varrerReservasVencidas(campoId: string): Promise<string[]>
    marcarEnviado(id: string, wamid: string, quando: Date): Promise<void>
    /** `talvezEnviado`: a Meta pode ter entregue (conta no limite de 24 h). */
    marcarFalha(id: string, codigo: number | null, erro: string, talvezEnviado: boolean): Promise<void>
    /** Contadores por agregação do próprio disparo; `enviando` sem pendentes vira `concluido`. */
    recalcular(disparoId: string): Promise<void>
    buscarEnvioPorWamid(campoId: string, wamid: string): Promise<{ id: string; status: string; disparoId: string } | null>
    trocarStatusEnvio(id: string, de: string, para: StatusEnvio, erro: { codigo: number | null; mensagem: string } | null): Promise<boolean>
    inserirExclusao(campoId: string, telefone: string, motivo: string): Promise<void>
    ignorarPendentesDoTelefone(campoId: string, telefone: string): Promise<void>
  }
  modelos: {
    buscar(campoId: string, id: string): Promise<{ id: string; campoId: string; status: string; nome: string; idioma: string; categoria: string; variaveis: unknown } | null>
  }
  conexoes: {
    buscarConexaoDoCampo(campoId: string): Promise<{ phoneNumberId: string; tokenCifrado: string; status: string } | null>
    buscarPorPhoneNumberId(phoneNumberId: string): Promise<{ campoId: string } | null>
    marcarErro(campoId: string, msg: string): Promise<void>
  }
  graph: Graph
  /** Status do número (qualidade e nível de limite) — leitura, sem custo. */
  lerStatus(token: string, phoneNumberId: string): Promise<{ qualidade: string; limiteDiario: string | null }>
  alertas: { gravar(campoId: string, mensagem: string): Promise<void> }
  chave: string
  cifra: { decifrar(cifrado: string, chaveHex: string): string }
  novoId: () => string
  /** Relógio para o prazo da rodada (padrão Date.now). */
  agoraMs?: () => number
}

// ---------- constantes e mensagens ----------

export const MAX_LOTE = 60
export const LIMITE_PUBLICO = 20_000
const CHECAR_STATUS_A_CADA = 10
const DIA_MS = 24 * 60 * 60 * 1000
const LIMITE_PADRAO = 250

export const MSG_SEM_CONEXAO_ENVIO = 'Conecte o número do WhatsApp Oficial antes de enviar.'
export const MSG_LIMITE = 'Limite diário do número atingido. O envio continua sozinho quando o limite liberar.'
export const MSG_QUALIDADE_RED = 'A qualidade do número ficou vermelha. Envio pausado para proteger o número.'
export const MSG_PAUSADO_MANUAL = 'Pausado por um usuário.'
const MSG_TIMEOUT_ENVIO = 'A Meta não respondeu a tempo. Não reenviamos para não cobrar duas vezes.'

const MOTIVO_CODIGO: Record<number, string> = {
  131042: 'A Meta recusou por problema de pagamento da conta (131042). Confira a forma de pagamento no Gerenciador do WhatsApp.',
  131031: 'A conta do WhatsApp foi bloqueada ou restringida pela Meta (131031).',
  368: 'A Meta restringiu temporariamente o número por violação de política (368).',
  190: `${MSG_TOKEN_RECUSADO} (190)`,
}
const CODIGO_TENTAR_DEPOIS = 130429 // limite de vazão: a Meta recusou, nada saiu; o item volta à fila
/** POSTs simultâneos por rodada (cada item grava logo após o próprio POST). */
export const CONCORRENCIA_ENVIO = 5

const ATIVOS: StatusDisparo[] = ['enviando', 'aguardando_limite', 'agendado']

// ---------- regras puras ----------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA = /^\d{4}-\d{2}-\d{2}$/
const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** A Meta recusa parâmetro com quebra de linha, tab ou mais de 4 espaços seguidos. */
export function sanearParametro(v: string): string {
  return String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim()
}

function dataValida(s: unknown): s is string {
  if (typeof s !== 'string' || !DATA.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function lista(v: unknown, nome: string, erros: string[], uuid = false): string[] {
  if (v == null) return []
  if (!Array.isArray(v) || v.length > 200 || v.some((x) => typeof x !== 'string' || !x.trim() || x.length > 120)) {
    erros.push(`Filtro "${nome}" inválido.`)
    return []
  }
  if (uuid && v.some((x) => !UUID.test(x))) {
    erros.push(`Filtro "${nome}" inválido.`)
    return []
  }
  return [...new Set(v.map((x: string) => x.trim()))]
}

function lerFiltros(f: unknown): { filtros: FiltrosPublico; erros: string[] } {
  const erros: string[] = []
  const filtros: FiltrosPublico = { membros: null, interessados: null }
  if (!ehObj(f)) return { filtros, erros: ['Escolha o público (membros e/ou interessados).'] }
  if (f.membros != null) {
    if (!ehObj(f.membros)) erros.push('Filtro de membros inválido.')
    else {
      const m = f.membros
      let mes: number | null = null
      if (m.mesAniversario != null) {
        if (!Number.isInteger(m.mesAniversario) || (m.mesAniversario as number) < 1 || (m.mesAniversario as number) > 12) erros.push('Mês de aniversário inválido.')
        else mes = m.mesAniversario as number
      }
      filtros.membros = {
        igrejaIds: lista(m.igrejaIds, 'igreja', erros, true),
        situacoes: lista(m.situacoes, 'situação', erros),
        titulos: lista(m.titulos, 'título', erros),
        mesAniversario: mes,
      }
    }
  }
  if (f.interessados != null) {
    if (!ehObj(f.interessados)) erros.push('Filtro de interessados inválido.')
    else {
      const i = f.interessados
      const de = i.cadastroDe == null || i.cadastroDe === '' ? null : i.cadastroDe
      const ate = i.cadastroAte == null || i.cadastroAte === '' ? null : i.cadastroAte
      if (de !== null && !dataValida(de)) erros.push('Data inicial do cadastro inválida.')
      if (ate !== null && !dataValida(ate)) erros.push('Data final do cadastro inválida.')
      if (dataValida(de) && dataValida(ate) && de > ate) erros.push('A data inicial do cadastro é depois da final.')
      filtros.interessados = {
        igrejaIds: lista(i.igrejaIds, 'igreja', erros, true),
        origens: lista(i.origens, 'origem', erros),
        cadastroDe: dataValida(de) ? de : null,
        cadastroAte: dataValida(ate) ? ate : null,
      }
    }
  }
  if (!erros.length && !filtros.membros && !filtros.interessados) erros.push('Escolha o público (membros e/ou interessados).')
  return { filtros, erros }
}

/** Erros dos filtros do público (vazio = ok). */
export function validarFiltros(f: unknown): string[] {
  return lerFiltros(f).erros
}

const LIMITE_VALOR = { data: 60, livre: 200 } as const

/**
 * Valida e normaliza o corpo de um disparo. Com `variaveis` (do modelo escolhido), exige
 * os valores de `data`/`livre` que o modelo usa. Valores saem saneados para a Meta.
 */
export function validarEntradaDisparo(
  entrada: unknown,
  opts: { variaveis?: VariavelModelo[]; agora: Date },
): { ok: true; valor: EntradaDisparo } | { ok: false; erros: string[] } {
  if (!ehObj(entrada)) return { ok: false, erros: ['Corpo inválido.'] }
  const erros: string[] = []
  const nome = typeof entrada.nome === 'string' ? entrada.nome.trim() : ''
  if (!nome || nome.length > 120) erros.push('Informe um nome para o disparo (até 120 caracteres).')
  const modeloId = typeof entrada.modeloId === 'string' ? entrada.modeloId : ''
  if (!UUID.test(modeloId)) erros.push('Escolha um modelo aprovado.')
  const { filtros, erros: errosFiltro } = lerFiltros(entrada.filtros)
  erros.push(...errosFiltro)

  const brutos = ehObj(entrada.valores) ? entrada.valores : {}
  const valores: ValoresDisparo = {}
  for (const k of ['data', 'livre'] as const) {
    const v = brutos[k]
    if (v == null || v === '') continue
    if (typeof v !== 'string') { erros.push(`Valor de "${k}" inválido.`); continue }
    const s = sanearParametro(v)
    if (s.length > LIMITE_VALOR[k]) erros.push(`O valor de "${k}" passa de ${LIMITE_VALOR[k]} caracteres.`)
    else if (s) valores[k] = s
  }
  const usados = new Set((opts.variaveis ?? []).map((v) => v.tipo))
  if (usados.has('data') && !valores.data) erros.push('O modelo usa a variável "data": preencha o valor.')
  if (usados.has('livre') && !valores.livre) erros.push('O modelo usa a variável "texto livre": preencha o valor.')

  let agendadoPara: string | null = null
  if (entrada.agendadoPara != null && entrada.agendadoPara !== '') {
    const d = typeof entrada.agendadoPara === 'string' ? new Date(entrada.agendadoPara) : new Date(NaN)
    if (Number.isNaN(d.getTime())) erros.push('Data do agendamento inválida.')
    else if (d.getTime() <= opts.agora.getTime()) erros.push('O agendamento precisa ser no futuro.')
    else if (d.getTime() > opts.agora.getTime() + 60 * DIA_MS) erros.push('Agende para no máximo 60 dias.')
    else agendadoPara = d.toISOString()
  }
  if (erros.length) return { ok: false, erros }
  return { ok: true, valor: { nome, modeloId, filtros, valores, agendadoPara } }
}

/** Nível de limite da Meta (ex.: TIER_250, TIER_2K) em mensagens/24 h. Desconhecido ⇒ 250 (o menor). */
export function limiteDoNivel(nivel: string | null): number {
  if (!nivel) return LIMITE_PADRAO
  if (nivel === 'TIER_UNLIMITED') return Infinity
  const m = /^TIER_(\d+)(K?)$/.exec(nivel)
  if (!m) return LIMITE_PADRAO
  return Number(m[1]) * (m[2] ? 1000 : 1)
}

const ORDEM: Record<string, number> = { pendente: 0, enviado: 1, entregue: 2, lido: 3 }
/** Status do envio nunca regride; `falhou` só sobrescreve pendente/enviado. */
export function podeAvancarStatus(atual: string, novo: string): boolean {
  if (novo === 'falhou') return atual === 'pendente' || atual === 'enviado'
  if (!(atual in ORDEM) || !(novo in ORDEM)) return false
  return ORDEM[novo] > ORDEM[atual]
}

const STATUS_DA_META: Record<string, StatusEnvio> = { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'falhou' }

/**
 * Telefone de quem escreveu (wa_id). No Brasil o wa_id de alguns celulares vem sem o 9
 * (55 + DDD + 8 dígitos começando com 6–9): acrescenta o 9 para casar com o cadastro.
 */
export function telefoneDoWaId(waId: string): string | null {
  const d = String(waId ?? '').replace(/\D/g, '')
  const n = normalizarTelefoneBR(d)
  if (n) return n
  const m = /^55([1-9]{2})([6-9]\d{7})$/.exec(d)
  return m ? `55${m[1]}9${m[2]}` : null
}

export type EventosWebhook = {
  statuses: Array<{ phoneNumberId: string; wamid: string; status: string; erroCodigo: number | null; erro: string | null }>
  mensagens: Array<{ phoneNumberId: string; from: string; texto: string }>
}

/** Lê `entry[].changes[].value` do payload da Meta; tudo que não tiver a forma esperada é ignorado. */
export function extrairEventosWebhook(payload: unknown): EventosWebhook {
  const saida: EventosWebhook = { statuses: [], mensagens: [] }
  if (!ehObj(payload) || !Array.isArray(payload.entry)) return saida
  for (const entry of payload.entry) {
    if (!ehObj(entry) || !Array.isArray(entry.changes)) continue
    for (const ch of entry.changes) {
      if (!ehObj(ch) || !ehObj(ch.value)) continue
      const v = ch.value
      const pn = ehObj(v.metadata) && typeof v.metadata.phone_number_id === 'string' ? v.metadata.phone_number_id : ''
      if (!pn) continue
      for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
        if (!ehObj(s) || typeof s.id !== 'string' || typeof s.status !== 'string' || !(s.status in STATUS_DA_META)) continue
        const e0 = Array.isArray(s.errors) && ehObj(s.errors[0]) ? s.errors[0] : null
        saida.statuses.push({
          phoneNumberId: pn, wamid: s.id, status: s.status,
          erroCodigo: e0 && typeof e0.code === 'number' ? e0.code : null,
          erro: e0 ? String(e0.title ?? e0.message ?? '').slice(0, 300) || null : null,
        })
      }
      for (const m of Array.isArray(v.messages) ? v.messages : []) {
        if (!ehObj(m) || m.type !== 'text' || typeof m.from !== 'string' || !ehObj(m.text) || typeof m.text.body !== 'string') continue
        saida.mensagens.push({ phoneNumberId: pn, from: m.from, texto: m.text.body })
      }
    }
  }
  return saida
}

/**
 * Público final: celular válido (membro: celular, senão telefone), fora da lista de exclusão
 * e sem repetir telefone (membro vence interessado). Nome = nome preferido ou nome completo.
 */
export function montarPublico(
  linhas: { membros: LinhaMembro[]; interessados: LinhaInteressado[] },
  excluidos: Set<string>,
): { contatos: Contato[]; semCelular: number; excluidos: number; duplicados: number } {
  let semCelular = 0
  let fora = 0
  const brutos: Contato[] = []
  const add = (c: Omit<Contato, 'telefone'>, fones: Array<string | null>) => {
    const tel = fones.map((f) => normalizarTelefoneBR(f)).find((t): t is string => !!t)
    if (!tel) { semCelular++; return }
    if (excluidos.has(tel)) { fora++; return }
    brutos.push({ ...c, telefone: tel })
  }
  for (const m of linhas.membros) {
    add({ origem: 'membro', refId: m.id, nome: m.preferredName?.trim() || m.fullName, igrejaNome: m.igrejaNome }, [m.mobile, m.phone])
  }
  for (const l of linhas.interessados) {
    add({ origem: 'interessado', refId: l.id, nome: l.fullName, igrejaNome: l.igrejaNome }, [l.phone])
  }
  const contatos = deduplicarPorTelefone(brutos)
  return { contatos, semCelular, excluidos: fora, duplicados: brutos.length - contatos.length }
}

// ---------- serviço ----------

function variaveisDoModelo(v: unknown): VariavelModelo[] {
  return Array.isArray(v) ? (v as VariavelModelo[]).filter((x) => x && typeof x.posicao === 'number' && typeof x.tipo === 'string') : []
}

async function token(deps: DepsEnvio, campoId: string): Promise<{ phoneNumberId: string; token: string }> {
  const c = await deps.conexoes.buscarConexaoDoCampo(campoId)
  if (!c || c.status === 'desconectado' || !c.tokenCifrado) throw new ErroServico(409, MSG_SEM_CONEXAO_ENVIO)
  try {
    return { phoneNumberId: c.phoneNumberId, token: deps.cifra.decifrar(c.tokenCifrado, deps.chave) }
  } catch {
    await deps.conexoes.marcarErro(campoId, MSG_TOKEN_RECUSADO)
    throw new ErroServico(401, MSG_TOKEN_RECUSADO)
  }
}

export async function contarPublico(
  deps: DepsEnvio, campoId: string, filtros: unknown,
): Promise<{ membros: number; interessados: number; total: number }> {
  const { filtros: f, erros } = lerFiltros(filtros)
  if (erros.length) throw new ErroServico(400, erros.join(' '))
  const r = await deps.repo.contarPublico(campoId, f)
  return { membros: r.membros, interessados: r.interessados, total: r.membros + r.interessados }
}

/** Limite restante do número nas últimas 24 h (limite do nível − envios do campo). */
export async function limiteRestante(
  deps: DepsEnvio, campoId: string, agora: Date,
): Promise<{ limite: number; usados: number; restante: number; qualidade: string }> {
  const { phoneNumberId, token: tk } = await token(deps, campoId)
  const s = await deps.lerStatus(tk, phoneNumberId)
  return calcularRestante(deps, campoId, agora, s)
}

async function calcularRestante(
  deps: DepsEnvio, campoId: string, agora: Date, s: { qualidade: string; limiteDiario: string | null },
) {
  const limite = limiteDoNivel(s.limiteDiario)
  const usados = await deps.repo.enviadosDesde(campoId, new Date(agora.getTime() - DIA_MS))
  return { limite, usados, restante: Math.max(0, limite - usados), qualidade: s.qualidade }
}

export async function criarDisparo(
  deps: DepsEnvio, campoId: string, userId: string | null, entrada: unknown, agora: Date,
): Promise<{ id: string; total: number; semCelular: number; excluidos: number; duplicados: number; status: StatusDisparo }> {
  const pre = validarEntradaDisparo(entrada, { agora })
  if (!pre.ok) throw new ErroServico(400, pre.erros.join(' '))
  await token(deps, campoId)
  const modelo = await deps.modelos.buscar(campoId, pre.valor.modeloId)
  if (!modelo || modelo.campoId !== campoId) throw new ErroServico(404, 'Modelo não encontrado.')
  if (modelo.status !== 'APPROVED') throw new ErroServico(400, 'Só é possível enviar modelos aprovados pela Meta.')
  const variaveis = variaveisDoModelo(modelo.variaveis)
  const v = validarEntradaDisparo(entrada, { agora, variaveis })
  if (!v.ok) throw new ErroServico(400, v.erros.join(' '))
  const e = v.valor

  const linhas = await deps.repo.listarContatos(campoId, e.filtros, LIMITE_PUBLICO + 1)
  if (linhas.membros.length > LIMITE_PUBLICO || linhas.interessados.length > LIMITE_PUBLICO) {
    throw new ErroServico(400, `O público passa de ${LIMITE_PUBLICO.toLocaleString('pt-BR')} pessoas. Use os filtros para dividir em disparos menores.`)
  }
  const candidatos = [
    ...linhas.membros.flatMap((m) => [m.mobile, m.phone]),
    ...linhas.interessados.map((l) => l.phone),
  ].map((t) => normalizarTelefoneBR(t)).filter((t): t is string => !!t)
  const excluidos = await deps.repo.telefonesExcluidos(campoId, [...new Set(candidatos)])
  const p = montarPublico(linhas, excluidos)
  if (!p.contatos.length) throw new ErroServico(400, 'Nenhuma pessoa com celular válido nesse público.')

  const id = deps.novoId()
  const agendadoPara = e.agendadoPara ? new Date(e.agendadoPara) : null
  const status: StatusDisparo = agendadoPara ? 'agendado' : 'enviando'
  const envios: NovoEnvio[] = p.contatos.map((c) => {
    const par = montarParametros(variaveis, c, e.valores)
    const parametros: Parametros = { body: par.body.map(sanearParametro) }
    if (par.header) parametros.header = par.header.map(sanearParametro)
    return { disparoId: id, campoId, origem: c.origem, refId: c.refId, nome: c.nome, telefone: c.telefone, parametros }
  })
  await deps.repo.criarDisparoComEnvios({
    id, campoId, modeloId: modelo.id, modeloNome: modelo.nome, idioma: modelo.idioma, categoria: modelo.categoria,
    nome: e.nome, filtros: e.filtros, valores: e.valores, status, agendadoPara, total: envios.length, criadoPor: userId,
  }, envios)
  return { id, total: envios.length, semCelular: p.semCelular, excluidos: p.excluidos, duplicados: p.duplicados, status }
}

async function disparoDoCampo(deps: DepsEnvio, campoId: string, id: string): Promise<DisparoLinha> {
  const d = await deps.repo.buscarDisparo(campoId, id)
  if (!d || d.campoId !== campoId) throw new ErroServico(404, 'Disparo não encontrado.')
  return d
}

export async function pausar(deps: DepsEnvio, campoId: string, id: string): Promise<void> {
  const d = await disparoDoCampo(deps, campoId, id)
  if (!ATIVOS.includes(d.status as StatusDisparo) || !(await deps.repo.mudarStatus(id, ATIVOS, 'pausado', MSG_PAUSADO_MANUAL))) {
    throw new ErroServico(409, 'Este disparo não está em andamento.')
  }
}

export async function retomar(deps: DepsEnvio, campoId: string, id: string, agora: Date = new Date()): Promise<void> {
  const d = await disparoDoCampo(deps, campoId, id)
  const para: StatusDisparo = d.agendadoPara && d.agendadoPara.getTime() > agora.getTime() ? 'agendado' : 'enviando'
  if (d.status !== 'pausado' || !(await deps.repo.mudarStatus(id, ['pausado'], para, null))) {
    throw new ErroServico(409, 'Só é possível retomar um disparo pausado.')
  }
}

export async function cancelar(deps: DepsEnvio, campoId: string, id: string): Promise<void> {
  const d = await disparoDoCampo(deps, campoId, id)
  const de = [...ATIVOS, 'pausado']
  if (!de.includes(d.status) || !(await deps.repo.cancelar(id, de))) {
    throw new ErroServico(409, 'Este disparo já terminou.')
  }
  await deps.repo.recalcular(id)
}

async function pausarTodos(deps: DepsEnvio, campoId: string, ativos: DisparoLinha[], motivo: string, alertar: boolean): Promise<void> {
  let algum = false
  for (const d of ativos) {
    if (await deps.repo.mudarStatus(d.id, ATIVOS, 'pausado', motivo)) algum = true
  }
  if (algum && alertar) await deps.alertas.gravar(campoId, `Envio em massa pausado: ${motivo}`)
}

export type ResultadoFila = { enviados: number; falhas: number; pausado?: string; aguardandoLimite?: boolean; erro?: string }

/**
 * Uma rodada da fila do campo: no máximo MAX_LOTE envios, nunca acima do limite restante,
 * e para antes de `prazoMs` (relógio de deps.agoraMs). Disparos mais antigos primeiro.
 */
export async function processarFila(
  deps: DepsEnvio, campoId: string, agora: Date, opts: { prazoMs?: number } = {},
): Promise<ResultadoFila> {
  const agoraMs = deps.agoraMs ?? Date.now
  const fim = agoraMs() + (opts.prazoMs ?? 40_000)
  const res: ResultadoFila = { enviados: 0, falhas: 0 }
  // Idas ao banco independentes vão juntas (o pooler cobra ~0,7 s por ida e volta).
  const [vencidos, ativos] = await Promise.all([deps.repo.varrerReservasVencidas(campoId), deps.repo.disparosAtivos(campoId, agora)])
  await Promise.all(vencidos.map((id) => deps.repo.recalcular(id)))
  if (!ativos.length) return res

  let con: { phoneNumberId: string; token: string }
  try {
    con = await token(deps, campoId)
  } catch (e) {
    const msg = e instanceof ErroServico ? e.message : MSG_SEM_CONEXAO_ENVIO
    await pausarTodos(deps, campoId, ativos, msg, e instanceof ErroServico && e.status === 401)
    return { ...res, pausado: msg }
  }

  let status: { qualidade: string; limiteDiario: string | null }
  const usados24h = deps.repo.enviadosDesde(campoId, new Date(agora.getTime() - DIA_MS))
  usados24h.catch(() => undefined) // evita rejeição solta se sairmos antes de usar
  try {
    status = await deps.lerStatus(con.token, con.phoneNumberId)
  } catch (e) {
    const err = e as { tokenInvalido?: boolean; codigo?: number | null }
    if (err?.tokenInvalido || err?.codigo === 190) {
      await deps.conexoes.marcarErro(campoId, MSG_TOKEN_RECUSADO)
      await pausarTodos(deps, campoId, ativos, MOTIVO_CODIGO[190], true)
      return { ...res, pausado: MOTIVO_CODIGO[190] }
    }
    return { ...res, erro: 'leitura do status do número falhou' } // tenta no próximo minuto
  }
  if (status.qualidade === 'RED') {
    await pausarTodos(deps, campoId, ativos, MSG_QUALIDADE_RED, true)
    return { ...res, pausado: MSG_QUALIDADE_RED }
  }

  let restante = Math.max(0, limiteDoNivel(status.limiteDiario) - (await usados24h))
  let usados = 0

  for (const d of ativos) {
    if (restante <= 0 || usados >= MAX_LOTE || agoraMs() >= fim) break
    if (d.status !== 'enviando' && !(await deps.repo.mudarStatus(d.id, [d.status], 'enviando', null))) continue
    const n = tamanhoDoLote(restante, Number.MAX_SAFE_INTEGER, MAX_LOTE - usados)
    const lote = await deps.repo.reservarPendentes(d.id, n)
    if (!lote.length) { await deps.repo.recalcular(d.id); continue }

    // Reserva irrevogável: só voltam à fila (liberarReserva) os itens cujo POST não começou e os
    // que a Meta recusou explicitamente (130429 ou código de parada: nada saiu). Timeout, erro sem
    // código ou falha de gravação depois do POST ⇒ nunca volta (falhou, ou a varredura converte).
    // Até CONCORRENCIA_ENVIO POSTs ao mesmo tempo; cada item grava logo após o próprio POST.
    let proximo = 0
    let verificadoAte = 0
    let portao: Promise<void> | null = null
    // `as`: o TS não estreita para null (as variáveis mudam dentro dos operários).
    let parar = null as { motivo: string; codigo: number } | null
    let encerrar = false as boolean
    let erroInterno = null as unknown

    const enviarUm = async (env: (typeof lote)[number]) => {
      const corpo = montarMensagemTemplate(env.telefone, d.modeloNome, d.idioma, env.parametros as Parametros)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let r: any
      try {
        r = await deps.graph.post(`${con.phoneNumberId}/messages`, corpo, con.token)
      } catch (e) {
        const err = e as { name?: string; message?: string; codigo?: number | null }
        const codigo = err?.name === 'ErroGraph' && typeof err.codigo === 'number' ? err.codigo : null
        if (codigo !== null && (codigo === CODIGO_TENTAR_DEPOIS || CODIGOS_PARAR_DISPARO.includes(codigo))) {
          // Recusa explícita da Meta: nada saiu, o item volta a pendente livre.
          await deps.repo.liberarReserva([env.id])
          if (codigo === CODIGO_TENTAR_DEPOIS) encerrar = true
          else parar ??= { motivo: MOTIVO_CODIGO[codigo] ?? `A Meta recusou (${codigo}).`, codigo }
          return
        }
        if (err?.name === 'ErroGraph' && codigo !== null) {
          // Erro da Meta por pessoa (ex.: 131026): só esta pessoa falha.
          await deps.repo.marcarFalha(env.id, codigo, String(err.message ?? 'Erro da Meta').slice(0, 300), false)
          res.falhas++
          return
        }
        // Tempo esgotado, rede ou erro sem código: a Meta pode ter enviado; não reenvia e conta no limite.
        restante--
        encerrar = true
        await deps.repo.marcarFalha(env.id, null, MSG_TIMEOUT_ENVIO, true)
        res.falhas++
        return
      }
      // POST aceito: gravação fora do try do POST (falha do banco não é falha da Meta).
      restante--
      const wamid = r?.messages?.[0]?.id
      if (typeof wamid === 'string' && wamid) {
        await deps.repo.marcarEnviado(env.id, wamid, new Date(agoraMs()))
        res.enviados++
      } else {
        await deps.repo.marcarFalha(env.id, null, 'A Meta respondeu sem o id da mensagem.', true)
        res.falhas++
      }
    }

    const operario = async () => {
      try {
        for (;;) {
          if (portao) await portao
          if (parar || encerrar || erroInterno) return
          if (agoraMs() >= fim) { encerrar = true; return }
          const i = proximo
          if (i >= lote.length) return
          if (i > 0 && i % CHECAR_STATUS_A_CADA === 0 && verificadoAte < i) {
            // Confere o disparo (pausa/cancelamento) antes de começar o próximo bloco.
            verificadoAte = i
            portao = deps.repo.buscarDisparo(campoId, d.id)
              .then((atual) => { if (atual?.status !== 'enviando') encerrar = true })
              .finally(() => { portao = null })
            continue
          }
          proximo = i + 1
          usados++
          await enviarUm(lote[i])
        }
      } catch (e) {
        erroInterno ??= e
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ENVIO, lote.length) }, operario))
    } finally {
      const sobra = lote.slice(proximo).map((x) => x.id)
      if (sobra.length) await deps.repo.liberarReserva(sobra)
    }
    await deps.repo.recalcular(d.id)
    if (erroInterno) throw erroInterno

    if (parar) {
      if (parar.codigo === 190) await deps.conexoes.marcarErro(campoId, MSG_TOKEN_RECUSADO)
      await pausarTodos(deps, campoId, ativos, parar.motivo, true)
      return { ...res, pausado: parar.motivo }
    }
    if (encerrar) return res
  }

  if (restante <= 0) {
    for (const d of ativos) {
      if (await deps.repo.mudarStatus(d.id, ['enviando', 'agendado'], 'aguardando_limite', MSG_LIMITE)) res.aguardandoLimite = true
    }
  }
  return res
}

/** Aplica um status do webhook ao envio do campo dono do phone_number_id. Devolve se mudou. */
export async function aplicarStatusWebhook(deps: DepsEnvio, ev: EventoStatus): Promise<boolean> {
  const novo = STATUS_DA_META[ev.status]
  if (!novo || !ev.wamid) return false
  const dono = await deps.conexoes.buscarPorPhoneNumberId(ev.phoneNumberId)
  if (!dono) return false
  const erro = novo === 'falhou' ? { codigo: ev.erroCodigo ?? null, mensagem: (ev.erro ?? 'Falha informada pela Meta.').slice(0, 300) } : null
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const env = await deps.repo.buscarEnvioPorWamid(dono.campoId, ev.wamid)
    if (!env || !podeAvancarStatus(env.status, novo)) return false
    if (await deps.repo.trocarStatusEnvio(env.id, env.status, novo, erro)) {
      await deps.repo.recalcular(env.disparoId)
      return true
    }
  }
  return false
}

/** Pedido de SAIR: entra na lista de exclusão do campo e os pendentes desse telefone viram ignorados. */
export async function registrarSair(deps: DepsEnvio, phoneNumberId: string, waId: string): Promise<boolean> {
  const tel = telefoneDoWaId(waId)
  if (!tel) return false
  const dono = await deps.conexoes.buscarPorPhoneNumberId(phoneNumberId)
  if (!dono) return false
  await deps.repo.inserirExclusao(dono.campoId, tel, 'Pediu para sair pelo WhatsApp')
  await deps.repo.ignorarPendentesDoTelefone(dono.campoId, tel)
  return true
}

/**
 * Processa o payload inteiro do webhook (status e pedidos de SAIR). Cada evento é independente:
 * o erro de um não impede os outros; o primeiro erro volta em `primeiroErro` para o log.
 */
export async function processarWebhook(
  deps: DepsEnvio, payload: unknown,
): Promise<{ status: number; sair: number; erros: number; primeiroErro?: unknown }> {
  const ev = extrairEventosWebhook(payload)
  const r: { status: number; sair: number; erros: number; primeiroErro?: unknown } = { status: 0, sair: 0, erros: 0 }
  const falhou = (e: unknown) => { r.erros++; if (r.erros === 1) r.primeiroErro = e }
  for (const s of ev.statuses) {
    try { if (await aplicarStatusWebhook(deps, s)) r.status++ } catch (e) { falhou(e) }
  }
  for (const m of ev.mensagens) {
    if (!ehPedidoDeSair(m.texto)) continue
    try { if (await registrarSair(deps, m.phoneNumberId, m.from)) r.sair++ } catch (e) { falhou(e) }
  }
  return r
}
