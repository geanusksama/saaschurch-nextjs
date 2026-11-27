/**
 * Alertas das igrejas (não-base) chegando ao master no sistema base.
 *
 * Igreja: depois do monitor, manda ao base os alertas em aberto do próprio banco
 * que são de um campo (os globais — versão da Graph, webhook — o base já calcula
 * sozinho) e, com o "ok" do base, marca-os como resolvidos localmente: a cópia que
 * vale passa a ser a do base. Se o problema continuar, o monitor da igreja cria o
 * alerta de novo no dia seguinte e o base só o registra outra vez se o master já
 * tiver resolvido o anterior. Base fora do ar: nada é resolvido, reenvia no próximo ciclo.
 *
 * Base: valida, descarta o que já está aberto com o mesmo tipo + origem e grava
 * com `origem` = "<domínio da igreja> · <nome do campo>". Nunca aceita proposta
 * (só o próprio base propõe mudança de configuração).
 */
import type { TipoAlerta } from './monitorMeta'

export const TIPOS_ENCAMINHADOS: TipoAlerta[] = ['conexao_erro', 'qualidade_baixa', 'qualidade_media', 'monitor_falhou', 'envio_pausado']
export const MAX_ALERTAS_POR_ENVIO = 100
const MAX_MENSAGEM = 1000
const MAX_NOME = 200
const TIMEOUT_MS = 10_000

export type AlertaLocal = { id: string; tipo: string; mensagem: string; campoNome: string | null }
export type AlertaRecebido = { tipo: TipoAlerta; mensagem: string; campoNome: string | null }

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Domínio (host) de uma URL https; null se inválida. */
export function dominioDe(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.hostname === 'localhost' ? u.host.toLowerCase() : null
  } catch {
    return null
  }
}

export function montarOrigem(dominio: string, campoNome: string | null): string {
  return campoNome ? `${dominio} · ${campoNome}` : dominio
}

/** Valida o corpo recebido pelo base. */
export function validarRecebimento(corpo: unknown): { ok: true; dominio: string; alertas: AlertaRecebido[] } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Corpo inválido.' }
  const o = corpo as Record<string, unknown>
  const dominio = texto(o.dominio, MAX_NOME).toLowerCase()
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(dominio)) return { ok: false, erro: 'Domínio de origem inválido.' }
  if (!Array.isArray(o.alertas)) return { ok: false, erro: 'Lista de alertas ausente.' }
  if (o.alertas.length > MAX_ALERTAS_POR_ENVIO) return { ok: false, erro: `No máximo ${MAX_ALERTAS_POR_ENVIO} alertas por envio.` }
  const alertas: AlertaRecebido[] = []
  for (const a of o.alertas) {
    if (!a || typeof a !== 'object') return { ok: false, erro: 'Alerta inválido.' }
    const r = a as Record<string, unknown>
    const tipo = texto(r.tipo, 50) as TipoAlerta
    if (!TIPOS_ENCAMINHADOS.includes(tipo)) return { ok: false, erro: `Tipo de alerta não aceito: ${tipo || '(vazio)'}.` }
    const mensagem = texto(r.mensagem, MAX_MENSAGEM)
    if (!mensagem) return { ok: false, erro: 'Alerta sem mensagem.' }
    alertas.push({ tipo, mensagem, campoNome: texto(r.campoNome, MAX_NOME) || null })
  }
  return { ok: true, dominio, alertas }
}

export type DepsRecebimento = {
  abertosComOrigem: () => Promise<Array<{ tipo: string; origem: string | null }>>
  gravar: (alertas: Array<{ tipo: string; mensagem: string; origem: string }>) => Promise<void>
}

/** Base: grava só o que ainda não está aberto (mesmo tipo + origem). Devolve quantos entraram. */
export async function receberAlertas(dominio: string, alertas: AlertaRecebido[], deps: DepsRecebimento): Promise<number> {
  const chave = (t: string, o: string | null) => `${t}|${o ?? ''}`
  const vistos = new Set((await deps.abertosComOrigem()).map((a) => chave(a.tipo, a.origem)))
  const novos: Array<{ tipo: string; mensagem: string; origem: string }> = []
  for (const a of alertas) {
    const origem = montarOrigem(dominio, a.campoNome)
    const k = chave(a.tipo, origem)
    if (vistos.has(k)) continue
    vistos.add(k)
    novos.push({ tipo: a.tipo, mensagem: a.mensagem, origem })
  }
  if (novos.length) await deps.gravar(novos)
  return novos.length
}

export type DepsEncaminhar = {
  env: Record<string, string | undefined>
  fetch: typeof fetch
  abertosLocais: () => Promise<AlertaLocal[]>
  resolverLocais: (ids: string[]) => Promise<void>
}

export type ResultadoEncaminhar =
  | { encaminhados: number; motivo?: undefined }
  | { encaminhados: 0; motivo: 'base' | 'sem configuracao' | 'nada a enviar' | 'falha' }

/** Igreja: envia ao base os alertas de campo em aberto. Nunca lança. */
export async function encaminharAoBase(deps: DepsEncaminhar, urlBase: (v: string) => string | null): Promise<ResultadoEncaminhar> {
  const env = deps.env
  if ((env.META_CONFIG_BASE ?? '').trim() === '1') return { encaminhados: 0, motivo: 'base' }
  const base = urlBase((env.META_CONFIG_URL ?? '').trim())
  const token = (env.META_CONFIG_SYNC_TOKEN ?? '').trim()
  const dominio = dominioDe((env.META_CALLBACK_BASE_URL ?? '').trim())
  if (!base || !token || !dominio) return { encaminhados: 0, motivo: 'sem configuracao' }
  try {
    const locais = (await deps.abertosLocais())
      .filter((a) => (TIPOS_ENCAMINHADOS as string[]).includes(a.tipo))
      .slice(0, MAX_ALERTAS_POR_ENVIO)
    if (!locais.length) return { encaminhados: 0, motivo: 'nada a enviar' }
    const r = await deps.fetch(`${base}/api/meta/app-config/alertas/receber`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-meta-config-token': token },
      body: JSON.stringify({ dominio, alertas: locais.map(({ tipo, mensagem, campoNome }) => ({ tipo, mensagem, campoNome })) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!r.ok) {
      console.error('[meta/encaminhar-alertas] base respondeu', r.status)
      return { encaminhados: 0, motivo: 'falha' }
    }
    await deps.resolverLocais(locais.map((a) => a.id))
    return { encaminhados: locais.length }
  } catch (e) {
    console.error('[meta/encaminhar-alertas] falhou:', (e as Error)?.name)
    return { encaminhados: 0, motivo: 'falha' }
  }
}
