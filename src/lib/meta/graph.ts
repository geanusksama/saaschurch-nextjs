/**
 * Cliente mínimo da Graph API da Meta (WhatsApp Cloud API).
 * - Token vai no cabeçalho Authorization: Bearer, nunca na URL.
 * - Resposta com `error` lança ErroGraph (codigo 190 = token inválido/expirado).
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export class ErroGraph extends Error {
  status: number
  codigo: number | null
  tokenInvalido: boolean

  constructor(mensagem: string, status: number, codigo: number | null) {
    super(mensagem)
    this.name = 'ErroGraph'
    this.status = status
    this.codigo = codigo
    this.tokenInvalido = codigo === 190
  }
}

export type Graph = {
  get: (caminho: string, params?: Record<string, string>, token?: string) => Promise<any>
  post: (caminho: string, corpo: unknown, token?: string) => Promise<any>
  delete: (caminho: string, token?: string) => Promise<any>
}

export function criarGraph(opts: { versao: string; fetch?: FetchLike }): Graph {
  const base = `https://graph.facebook.com/${opts.versao}/`
  const executar: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init))

  async function chamar(url: string, init: RequestInit, token?: string): Promise<any> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
    if (token) headers.Authorization = `Bearer ${token}`
    const resposta = await executar(url, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15000) })
    const texto = await resposta.text()
    let json: any = null
    try { json = texto ? JSON.parse(texto) : null } catch { json = null }
    if (json && json.error) {
      const codigo = typeof json.error.code === 'number' ? json.error.code : null
      throw new ErroGraph(String(json.error.message ?? 'Erro da Graph API'), resposta.status, codigo)
    }
    if (!resposta.ok) throw new ErroGraph(`Graph API respondeu ${resposta.status}`, resposta.status, null)
    if (json === null) throw new ErroGraph(`Graph API respondeu ${resposta.status} sem JSON válido`, resposta.status, null)
    return json
  }

  return {
    get(caminho, params, token) {
      const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
      return chamar(base + caminho + qs, { method: 'GET' }, token)
    },
    delete(caminho, token) {
      return chamar(base + caminho, { method: 'DELETE' }, token)
    },
    post(caminho, corpo, token) {
      return chamar(base + caminho, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      }, token)
    },
  }
}
