/**
 * Regras dos modelos de mensagem do WhatsApp Oficial por campo. Dependências injetadas
 * (repositório, Graph, cifra) para testar sem banco nem rede. Nunca devolve token.
 *
 * `variaveis` (jsonb) guarda as variáveis do corpo, na ordem. Se o cabeçalho tem
 * variável, entra como último item com `posicao: 0` (tipo e exemplo do cabeçalho).
 */
import type { Graph } from './graph.ts'
import type { RascunhoModelo, VariavelModelo } from './modelos.ts'
import { validarRascunho, montarCorpoGraph, normalizarDaMeta } from './modelos.ts'
import { ErroServico, MSG_TOKEN_RECUSADO, MSG_TIMEOUT } from './servicoConexao.ts'

export const MSG_SEM_CONEXAO = 'Conecte o número do WhatsApp Oficial antes de usar os modelos.'

export type ModeloResumo = {
  id: string
  campoId: string
  wabaId: string
  metaTemplateId: string
  nome: string
  idioma: string
  categoria: string
  status: string
  motivoRecusa: string | null
  componentes: unknown
  variaveis: unknown
  criadoPor: string | null
  criadoEm: Date | null
  atualizadoEm: Date
  sincronizadoEm: Date | null
}

export type LinhaModelo = {
  campoId: string
  wabaId: string
  metaTemplateId: string
  nome: string
  idioma: string
  categoria: string
  status: string
  motivoRecusa: string | null
  componentes: unknown
  variaveis: unknown
  criadoPor: string | null
  sincronizadoEm: Date | null
}

export type DepsModelos = {
  repo: {
    listar(campoId: string): Promise<ModeloResumo[]>
    substituirDoCampo(campoId: string, linhas: LinhaModelo[]): Promise<void>
    inserir(linha: LinhaModelo): Promise<ModeloResumo>
    buscar(campoId: string, id: string): Promise<ModeloResumo | null>
    remover(id: string): Promise<void>
  }
  conexoes: {
    buscarConexaoDoCampo(campoId: string): Promise<{ wabaId: string; tokenCifrado: string; status: string } | null>
    marcarErro(campoId: string, msg: string): Promise<void>
  }
  graph: Graph
  chave: string
  cifra: { decifrar(cifrado: string, chaveHex: string): string }
}

const MAX_PAGINAS = 5
const CAMPOS = 'id,name,language,category,status,rejected_reason,components'

async function comConexao(deps: DepsModelos, campoId: string): Promise<{ wabaId: string; token: string }> {
  const c = await deps.conexoes.buscarConexaoDoCampo(campoId)
  if (!c || c.status === 'desconectado') throw new ErroServico(409, MSG_SEM_CONEXAO)
  let token: string
  try {
    token = deps.cifra.decifrar(c.tokenCifrado, deps.chave)
  } catch {
    await deps.conexoes.marcarErro(campoId, MSG_TOKEN_RECUSADO)
    throw new ErroServico(401, MSG_TOKEN_RECUSADO)
  }
  return { wabaId: c.wabaId, token }
}

async function traduzir(deps: DepsModelos, campoId: string, e: unknown): Promise<never> {
  if (e instanceof ErroServico) throw e
  const err = e as { name?: string; message?: string; codigo?: number | null }
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') throw new ErroServico(504, MSG_TIMEOUT)
  if (err?.name === 'ErroGraph') {
    if (err.codigo === 190) {
      await deps.conexoes.marcarErro(campoId, MSG_TOKEN_RECUSADO)
      throw new ErroServico(401, MSG_TOKEN_RECUSADO)
    }
    throw new ErroServico(502, `A Meta recusou: ${err.message ?? 'erro desconhecido'}`)
  }
  throw e
}

export function listarModelos(deps: DepsModelos, campoId: string): Promise<ModeloResumo[]> {
  return deps.repo.listar(campoId)
}

export async function sincronizarModelos(deps: DepsModelos, campoId: string): Promise<{ total: number }> {
  const { wabaId, token } = await comConexao(deps, campoId)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lidos: any[] = []
    let params: Record<string, string> = { fields: CAMPOS, limit: '100' }
    const caminho = `${wabaId}/message_templates`
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const r = await deps.graph.get(caminho, params, token)
      if (Array.isArray(r?.data)) lidos.push(...r.data)
      const depois = r?.paging?.cursors?.after
      if (!r?.paging?.next || !depois) break
      params = { fields: CAMPOS, limit: '100', after: String(depois) }
    }
    const existentes = await deps.repo.listar(campoId)
    const porId = new Map(existentes.map((m) => [m.metaTemplateId, m]))
    const agora = new Date()
    const linhas: LinhaModelo[] = lidos.map((t) => {
      const n = normalizarDaMeta(t)
      const antigo = porId.get(n.metaTemplateId)
      return {
        campoId, wabaId, ...n,
        variaveis: antigo?.variaveis ?? [],
        criadoPor: antigo?.criadoPor ?? null,
        sincronizadoEm: agora,
      }
    })
    await deps.repo.substituirDoCampo(campoId, linhas)
    return { total: linhas.length }
  } catch (e) {
    return traduzir(deps, campoId, e)
  }
}

/** Só as variáveis do corpo que aparecem no corpo (posição >= 1, sem repetir) e, se o cabeçalho tem variável, a posição 0 montada aqui. */
export function variaveisParaGravar(r: RascunhoModelo): VariavelModelo[] {
  const usadas = new Set([...(r.corpo ?? '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))
  const vistas = new Set<number>()
  const out: VariavelModelo[] = []
  for (const v of r.variaveis ?? []) {
    if (!(v.posicao >= 1) || !usadas.has(v.posicao) || vistas.has(v.posicao)) continue
    vistas.add(v.posicao)
    out.push(v)
  }
  if (/\{\{\d+\}\}/.test(r.cabecalho ?? '') && r.exemploCabecalho) {
    out.push({ posicao: 0, tipo: r.tipoCabecalho ?? 'livre', exemplo: r.exemploCabecalho })
  }
  return out
}

export async function criarModelo(
  deps: DepsModelos, campoId: string, userId: string | null, rascunho: RascunhoModelo,
): Promise<ModeloResumo> {
  const { wabaId, token } = await comConexao(deps, campoId)
  const erros = validarRascunho(rascunho)
  if (erros.length) throw new ErroServico(400, erros.join(' '))
  const corpo = montarCorpoGraph(rascunho)
  try {
    const r = await deps.graph.post(`${wabaId}/message_templates`, corpo, token)
    const variaveis = variaveisParaGravar(rascunho)
    return await deps.repo.inserir({
      campoId, wabaId,
      metaTemplateId: String(r?.id ?? ''),
      nome: corpo.name,
      idioma: corpo.language,
      categoria: String(r?.category || corpo.category),
      status: String(r?.status || 'PENDING'),
      motivoRecusa: null,
      componentes: corpo.components,
      variaveis,
      criadoPor: userId,
      sincronizadoEm: new Date(),
    })
  } catch (e) {
    return traduzir(deps, campoId, e)
  }
}

export async function excluirModelo(deps: DepsModelos, campoId: string, id: string): Promise<void> {
  const { wabaId, token } = await comConexao(deps, campoId)
  const m = await deps.repo.buscar(campoId, id)
  if (!m || m.campoId !== campoId) throw new ErroServico(404, 'Modelo não encontrado.')
  try {
    await deps.graph.delete(
      `${wabaId}/message_templates?hsm_id=${encodeURIComponent(m.metaTemplateId)}&name=${encodeURIComponent(m.nome)}`,
      token,
    )
  } catch (e) {
    const err = e as { name?: string; message?: string }
    const jaNaoExiste = err?.name === 'ErroGraph' && /does not exist|not found|n[aã]o existe/i.test(err.message ?? '')
    if (!jaNaoExiste) return traduzir(deps, campoId, e)
  }
  await deps.repo.remover(id)
}
