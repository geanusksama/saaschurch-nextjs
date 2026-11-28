/**
 * Configuração central do app Meta (nível do app, igual para todas as igrejas).
 * No sistema base (META_CONFIG_BASE=1) vem do banco; nas demais igrejas vem do
 * base por rota servidor-a-servidor, com cache de 5 minutos. Dependências
 * injetadas (repositório, fetch, relógio, env) para testar sem banco nem rede.
 * A chave de cifra e a URL de callback NÃO são centrais: ficam por implantação.
 */
export type ConfigCentral = {
  appId: string
  configId: string
  graphVersion: string
  verifyToken: string
  appSecret: string
  conexaoLiberada: boolean
}

/** Linha única de meta_app_config (segredo ainda cifrado). */
export type LinhaConfigCentral = {
  appId: string | null
  esConfigId: string | null
  graphVersion: string | null
  webhookVerifyToken: string | null
  appSecretCifrado: string | null
  conexaoLiberada: boolean
}

/** Linha da tabela de preços central (a vigência vai como AAAA-MM-DD). */
export type PrecoCentral = { categoria: string; moeda: string; preco: number; vigencia: string | null }

export function lerPrecosDoPayload(j: unknown): PrecoCentral[] | null {
  const l = j && typeof j === 'object' ? (j as { precos?: unknown }).precos : null
  if (!Array.isArray(l)) return null
  const out: PrecoCentral[] = []
  for (const x of l.slice(0, 100)) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const preco = Number(o.preco)
    if (typeof o.categoria !== 'string' || typeof o.moeda !== 'string' || !Number.isFinite(preco) || preco <= 0) continue
    out.push({ categoria: o.categoria, moeda: o.moeda, preco, vigencia: typeof o.vigencia === 'string' ? o.vigencia : null })
  }
  return out
}

export type DepsCentral = {
  env: Record<string, string | undefined>
  fetch: typeof fetch
  agora: () => number
  lerLinha: () => Promise<LinhaConfigCentral | null>
  decifrar: (cifrado: string, chaveHex: string) => string
  /** Tabela de preços do banco (só no base). */
  lerPrecos?: () => Promise<PrecoCentral[]>
}

export const TTL_CACHE_MS = 5 * 60 * 1000
/** Quanto tempo após vencer o cache ainda vale como reserva (sempre com conexaoLiberada=false). */
export const LIMITE_VENCIDO_MS = 60 * 60 * 1000
/** Após uma falha, não tenta de novo por este tempo (evita pagar o timeout a cada requisição). */
export const PAUSA_APOS_FALHA_MS = 60 * 1000
const TIMEOUT_MS = 5000

export const ehBase = (env: Record<string, string | undefined>) => (env.META_CONFIG_BASE ?? '').trim() === '1'

const vazio = (v: string | null | undefined) => (v ?? '').trim()

function dalinha(l: LinhaConfigCentral, env: Record<string, string | undefined>, decifrar: DepsCentral['decifrar']): ConfigCentral {
  const chave = vazio(env.META_TOKEN_ENCRYPTION_KEY)
  let appSecret = ''
  if (l.appSecretCifrado && chave) {
    try { appSecret = decifrar(l.appSecretCifrado, chave) } catch { appSecret = '' }
  }
  return {
    appId: vazio(l.appId), configId: vazio(l.esConfigId), graphVersion: vazio(l.graphVersion),
    verifyToken: vazio(l.webhookVerifyToken), appSecret, conexaoLiberada: l.conexaoLiberada === true,
  }
}

/** URL do base: https obrigatório (exceto localhost). */
export function urlBaseCentral(valor: string): string | null {
  try {
    const u = new URL(valor)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null
    return u.origin
  } catch {
    return null
  }
}

export function criarConfigCentral(deps: DepsCentral) {
  let cache: { valor: ConfigCentral; ate: number } | null = null
  let pausaAte = 0

  async function doBanco(): Promise<ConfigCentral | null> {
    const l = await deps.lerLinha()
    if (!l) return null
    return dalinha(l, deps.env, deps.decifrar)
  }

  async function doBase(): Promise<ConfigCentral | null> {
    const base = urlBaseCentral(vazio(deps.env.META_CONFIG_URL))
    const token = vazio(deps.env.META_CONFIG_SYNC_TOKEN)
    if (!base || !token) return null
    const r = await deps.fetch(`${base}/api/meta/app-config`, {
      headers: { 'x-meta-config-token': token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!r.ok) throw new Error(`base respondeu ${r.status}`)
    const j = (await r.json()) as Partial<ConfigCentral>
    return {
      appId: vazio(j.appId), configId: vazio(j.configId), graphVersion: vazio(j.graphVersion),
      verifyToken: vazio(j.verifyToken), appSecret: vazio(j.appSecret), conexaoLiberada: j.conexaoLiberada === true,
    }
  }

  /** Valor vencido só por até 1 h e nunca liberando a conexão. */
  function vencido(): ConfigCentral | null {
    if (!cache || deps.agora() > cache.ate + LIMITE_VENCIDO_MS) return null
    return { ...cache.valor, conexaoLiberada: false }
  }

  /** Valor central ou null se indisponível (o chamador usa o env como reserva). */
  async function lerCentral(): Promise<ConfigCentral | null> {
    try {
      if (ehBase(deps.env)) return await doBanco()
      if (cache && deps.agora() < cache.ate) return cache.valor
      if (deps.agora() < pausaAte) return vencido()
      const v = await doBase()
      if (v) cache = { valor: v, ate: deps.agora() + TTL_CACHE_MS }
      return v
    } catch (e) {
      console.error('[meta/config-central] indisponível, usando reserva:', (e as Error)?.name)
      pausaAte = deps.agora() + PAUSA_APOS_FALHA_MS
      return vencido()
    }
  }

  let cachePrecos: { valor: PrecoCentral[]; ate: number } | null = null
  let pausaPrecosAte = 0

  /**
   * Tabela de preços. Base: banco. Demais: do base (mesma rota da configuração), cache de 5 min;
   * base fora do ar ⇒ último valor lido (qualquer idade), senão null ("preço não configurado").
   */
  async function lerPrecos(): Promise<PrecoCentral[] | null> {
    try {
      if (ehBase(deps.env)) return deps.lerPrecos ? await deps.lerPrecos() : null
      if (cachePrecos && deps.agora() < cachePrecos.ate) return cachePrecos.valor
      if (deps.agora() < pausaPrecosAte) return cachePrecos?.valor ?? null
      const base = urlBaseCentral(vazio(deps.env.META_CONFIG_URL))
      const token = vazio(deps.env.META_CONFIG_SYNC_TOKEN)
      if (!base || !token) return cachePrecos?.valor ?? null
      const r = await deps.fetch(`${base}/api/meta/app-config`, {
        headers: { 'x-meta-config-token': token }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store',
      })
      if (!r.ok) throw new Error(`base respondeu ${r.status}`)
      const v = lerPrecosDoPayload(await r.json())
      if (v) cachePrecos = { valor: v, ate: deps.agora() + TTL_CACHE_MS }
      return v ?? cachePrecos?.valor ?? null
    } catch (e) {
      console.error('[meta/config-central] preços indisponíveis, usando o último valor:', (e as Error)?.name)
      pausaPrecosAte = deps.agora() + PAUSA_APOS_FALHA_MS
      return cachePrecos?.valor ?? null
    }
  }

  return { lerCentral, lerPrecos, limparCache: () => { cache = null; cachePrecos = null } }
}

/** Mescla: o central vale quando preenchido; o env cobre o resto (reserva). */
export function mesclarComEnv(central: ConfigCentral | null, env: Record<string, string | undefined>): ConfigCentral {
  const e = (n: string) => vazio(env[n])
  const pick = (c: string | undefined, nome: string) => {
    if (vazio(c)) return vazio(c)
    if (central && e(nome)) console.warn(`[meta/config-central] campo vazio na central, usando o ambiente: ${nome}`)
    return e(nome)
  }
  return {
    appId: pick(central?.appId, 'META_APP_ID'),
    configId: pick(central?.configId, 'META_ES_CONFIG_ID'),
    graphVersion: pick(central?.graphVersion, 'META_GRAPH_VERSION'),
    verifyToken: pick(central?.verifyToken, 'META_WEBHOOK_VERIFY_TOKEN'),
    appSecret: pick(central?.appSecret, 'META_APP_SECRET'),
    conexaoLiberada: central?.conexaoLiberada === true,
  }
}

/** O que o GET do master mostra: nunca o segredo. */
export function visaoPublica(l: LinhaConfigCentral | null, env: Record<string, string | undefined>) {
  return {
    appId: vazio(l?.appId) || vazio(env.META_APP_ID),
    configId: vazio(l?.esConfigId) || vazio(env.META_ES_CONFIG_ID),
    graphVersion: vazio(l?.graphVersion) || vazio(env.META_GRAPH_VERSION),
    verifyToken: vazio(l?.webhookVerifyToken) || vazio(env.META_WEBHOOK_VERIFY_TOKEN),
    appSecretDefinido: !!vazio(l?.appSecretCifrado) || !!vazio(env.META_APP_SECRET),
    conexaoLiberada: l?.conexaoLiberada === true,
  }
}

export type Atualizacao = {
  appId?: string; esConfigId?: string; graphVersion?: string; webhookVerifyToken?: string
  appSecret?: string; conexaoLiberada?: boolean
}

/** Valida o corpo do PUT. Só inclui o que veio; segredo vazio é ignorado. */
export function validarAtualizacao(corpo: unknown): { ok: true; dados: Atualizacao } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Corpo da requisição inválido.' }
  const c = corpo as Record<string, unknown>
  const dados: Atualizacao = {}
  const campos: Array<[string, keyof Atualizacao, string]> = [
    ['appId', 'appId', 'ID do app'], ['configId', 'esConfigId', 'Configuração do Embedded Signup'],
    ['graphVersion', 'graphVersion', 'Versão da Graph API'], ['verifyToken', 'webhookVerifyToken', 'Token do webhook'],
  ]
  for (const [entrada, saida, rotulo] of campos) {
    if (c[entrada] === undefined) continue
    if (typeof c[entrada] !== 'string') return { ok: false, erro: `${rotulo} inválido.` }
    const v = (c[entrada] as string).trim()
    if (!v) return { ok: false, erro: `${rotulo}: informe um valor.` }
    if (v.length > 200) return { ok: false, erro: `${rotulo} inválido.` }
    ;(dados as Record<string, unknown>)[saida] = v
  }
  if (dados.graphVersion && !/^v\d+\.\d+$/.test(dados.graphVersion)) {
    return { ok: false, erro: 'Versão da Graph API deve ter o formato v25.0.' }
  }
  if (c.appSecret !== undefined) {
    if (typeof c.appSecret !== 'string') return { ok: false, erro: 'Chave secreta inválida.' }
    const s = c.appSecret.trim()
    if (s.length > 500) return { ok: false, erro: 'Chave secreta inválida.' }
    if (s) dados.appSecret = s
  }
  if (c.conexaoLiberada !== undefined) {
    if (typeof c.conexaoLiberada !== 'boolean') return { ok: false, erro: 'Valor de liberação inválido.' }
    dados.conexaoLiberada = c.conexaoLiberada
  }
  return { ok: true, dados }
}
