/**
 * Regras da conexão do WhatsApp Oficial por campo. Dependências injetadas
 * (repositório, Graph, cifra) para testar sem banco nem rede.
 * Nunca devolve token nem PIN.
 */
import type { Graph } from './graph.ts'
import type { ConfigMeta } from './configMeta.ts'
import type { StatusNumero } from './conexaoMeta.ts'

export class ErroServico extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ErroServico'
    this.status = status
  }
}

export type ConexaoRegistro = {
  campoId: string
  wabaId: string
  phoneNumberId: string
  numero: string | null
  nomeExibicao: string | null
  tokenCifrado: string
  pinCifrado: string
  status: string
  ultimoErro: string | null
}

export type DadosSalvar = {
  campoId: string
  wabaId: string
  phoneNumberId: string
  numero: string
  nomeExibicao: string
  tokenCifrado: string
  pinCifrado: string
  conectadoPor: string | null
}

export type Dependencias = {
  repo: {
    buscarConexaoDoCampo(campoId: string): Promise<ConexaoRegistro | null>
    buscarPorPhoneNumberId(phoneNumberId: string): Promise<{ campoId: string } | null>
    salvarConexao(dados: DadosSalvar): Promise<void>
    marcarErro(campoId: string, msg: string): Promise<void>
    desconectar(campoId: string): Promise<void>
  }
  graph: Graph
  config: ConfigMeta
  cifra: {
    cifrar(texto: string, chaveHex: string): string
    decifrar(cifrado: string, chaveHex: string): string
  }
  meta: {
    trocarCodigo(graph: Graph, d: { appId: string; appSecret: string; code: string }): Promise<string>
    registrarNumero(graph: Graph, token: string, phoneNumberId: string, pin: string): Promise<void>
    assinarWebhookDaConta(
      graph: Graph, token: string, wabaId: string, d: { callbackUrl: string; verifyToken: string },
    ): Promise<void>
    lerStatusNumero(graph: Graph, token: string, phoneNumberId: string): Promise<StatusNumero>
    cancelarAssinaturaWebhook(graph: Graph, token: string, wabaId: string): Promise<void>
    gerarPin(): string
  }
}

export type RespostaConexao =
  | { conectado: false }
  | {
      conectado: true
      status: string
      numero: string | null
      nomeExibicao: string | null
      qualidade: string | null
      limiteDiario: string | null
      ultimoErro: string | null
    }

export const MSG_TOKEN_RECUSADO = 'Token recusado pela Meta. Reconecte o número.'
export const MSG_TOKEN_ILEGIVEL = 'Não foi possível ler as credenciais salvas. Reconecte o número.'
export const MSG_TIMEOUT = 'A Meta demorou para responder. Tente novamente em instantes.'
export const MSG_NAO_LIBERADA = 'Conexão ainda não liberada pelo administrador.'
export const MSG_DUPLICADO = 'Este número já está conectado a outro campo.'

function traduzir(e: unknown): never {
  if (e instanceof ErroServico) throw e
  const err = e as { name?: string; message?: string }
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') throw new ErroServico(504, MSG_TIMEOUT)
  if (err?.name === 'ErroGraph') throw new ErroServico(502, `A Meta recusou a operação: ${err.message ?? 'erro desconhecido'}`)
  throw e
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function obterStatus(deps: Dependencias, campoId: string): Promise<RespostaConexao> {
  const c = await deps.repo.buscarConexaoDoCampo(campoId)
  if (!c || c.status === 'desconectado') return { conectado: false }
  const base = {
    conectado: true as const,
    numero: c.numero,
    nomeExibicao: c.nomeExibicao,
    qualidade: null,
    limiteDiario: null,
  }
  let token: string
  try {
    token = deps.cifra.decifrar(c.tokenCifrado, deps.config.chaveCifra)
  } catch {
    await deps.repo.marcarErro(campoId, MSG_TOKEN_ILEGIVEL)
    return { ...base, status: 'erro', ultimoErro: MSG_TOKEN_ILEGIVEL }
  }
  try {
    const s = await deps.meta.lerStatusNumero(deps.graph, token, c.phoneNumberId)
    return {
      conectado: true,
      status: c.status,
      numero: s.numero || c.numero,
      nomeExibicao: s.nomeExibicao || c.nomeExibicao,
      qualidade: s.qualidade,
      limiteDiario: s.limiteDiario,
      ultimoErro: c.ultimoErro,
    }
  } catch (e) {
    if ((e as { tokenInvalido?: boolean })?.tokenInvalido) {
      await deps.repo.marcarErro(campoId, MSG_TOKEN_RECUSADO)
      return { ...base, status: 'erro', ultimoErro: MSG_TOKEN_RECUSADO }
    }
    return traduzir(e)
  }
}

/**
 * Status para a tela: consulta a linha do campo primeiro. Sem linha (ou desconectada),
 * responde sem montar dependências — logo, sem exigir a configuração da Meta.
 */
export async function obterStatusDoCampo(
  repo: Pick<Dependencias['repo'], 'buscarConexaoDoCampo'>,
  montarDeps: () => Promise<Dependencias>,
  campoId: string,
): Promise<RespostaConexao> {
  const c = await repo.buscarConexaoDoCampo(campoId)
  if (!c || c.status === 'desconectado') return { conectado: false }
  return obterStatus(await montarDeps(), campoId)
}

export async function conectar(
  deps: Dependencias,
  d: { campoId: string; userId: string | null; code: unknown; wabaId: unknown; phoneNumberId: unknown; ehMaster: boolean },
): Promise<RespostaConexao> {
  // O master pode conectar para testar mesmo com a liberação geral desligada.
  if (!deps.config.conexaoLiberada && !d.ehMaster) throw new ErroServico(403, MSG_NAO_LIBERADA)
  const code = texto(d.code)
  const wabaId = texto(d.wabaId)
  const phoneNumberId = texto(d.phoneNumberId)
  if (!code || !wabaId || !phoneNumberId) {
    throw new ErroServico(400, 'Informe code, wabaId e phoneNumberId.')
  }
  // Duplicado antes de qualquer chamada à Meta.
  const outro = await deps.repo.buscarPorPhoneNumberId(phoneNumberId)
  if (outro && outro.campoId !== d.campoId) throw new ErroServico(409, MSG_DUPLICADO)

  try {
    const token = await deps.meta.trocarCodigo(deps.graph, {
      appId: deps.config.appId, appSecret: deps.config.appSecret, code,
    })
    // Reconexão do mesmo número: reaproveita o PIN já registrado (a Meta o exige igual).
    let pin: string | null = null
    const anterior = await deps.repo.buscarConexaoDoCampo(d.campoId)
    if (anterior && anterior.phoneNumberId === phoneNumberId && anterior.pinCifrado) {
      try {
        pin = deps.cifra.decifrar(anterior.pinCifrado, deps.config.chaveCifra) || null
      } catch {
        pin = null
      }
    }
    if (!pin) pin = deps.meta.gerarPin()
    await deps.meta.registrarNumero(deps.graph, token, phoneNumberId, pin)
    await deps.meta.assinarWebhookDaConta(deps.graph, token, wabaId, {
      callbackUrl: `${deps.config.callbackBaseUrl}/api/meta/whatsapp/webhook`,
      verifyToken: deps.config.verifyToken,
    })
    const s = await deps.meta.lerStatusNumero(deps.graph, token, phoneNumberId)
    await deps.repo.salvarConexao({
      campoId: d.campoId,
      wabaId,
      phoneNumberId,
      numero: s.numero,
      nomeExibicao: s.nomeExibicao,
      tokenCifrado: deps.cifra.cifrar(token, deps.config.chaveCifra),
      pinCifrado: deps.cifra.cifrar(pin, deps.config.chaveCifra),
      conectadoPor: d.userId,
    })
    return {
      conectado: true,
      status: 'conectado',
      numero: s.numero,
      nomeExibicao: s.nomeExibicao,
      qualidade: s.qualidade,
      limiteDiario: s.limiteDiario,
      ultimoErro: null,
    }
  } catch (e) {
    return traduzir(e)
  }
}

export async function desconectar(deps: Dependencias, campoId: string): Promise<RespostaConexao> {
  // Melhor esforço: falha na Meta (ou token ilegível) não impede a desconexão local.
  try {
    const c = await deps.repo.buscarConexaoDoCampo(campoId)
    if (c && c.status !== 'desconectado') {
      const token = deps.cifra.decifrar(c.tokenCifrado, deps.config.chaveCifra)
      await deps.meta.cancelarAssinaturaWebhook(deps.graph, token, c.wabaId)
    }
  } catch (e) {
    console.error('[meta/whatsapp] cancelar assinatura falhou:', (e as Error)?.name)
  }
  await deps.repo.desconectar(campoId)
  return { conectado: false }
}
