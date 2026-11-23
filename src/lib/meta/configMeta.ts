/**
 * Configuração da Meta (WhatsApp Oficial). Nesta etapa vem das variáveis de ambiente;
 * a Task 8 troca a fonte para a configuração central mantendo esta assinatura.
 */
export type ConfigMeta = {
  appId: string
  appSecret: string
  configId: string
  verifyToken: string
  chaveCifra: string
  graphVersion: string
  callbackBaseUrl: string
}

export class ErroConfigMeta extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroConfigMeta'
  }
}

const VARIAVEIS = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_ES_CONFIG_ID',
  'META_WEBHOOK_VERIFY_TOKEN',
  'META_TOKEN_ENCRYPTION_KEY',
  'META_GRAPH_VERSION',
  'META_CALLBACK_BASE_URL',
] as const

export async function lerConfigMeta(): Promise<ConfigMeta> {
  const faltando = VARIAVEIS.filter((n) => !(process.env[n] ?? '').trim())
  if (faltando.length) throw new ErroConfigMeta(`Configuração da Meta incompleta: ${faltando.join(', ')}`)
  const v = (n: (typeof VARIAVEIS)[number]) => (process.env[n] as string).trim()
  const callbackBaseUrl = validarBaseUrl(v('META_CALLBACK_BASE_URL'))
  return {
    appId: v('META_APP_ID'),
    appSecret: v('META_APP_SECRET'),
    configId: v('META_ES_CONFIG_ID'),
    verifyToken: v('META_WEBHOOK_VERIFY_TOKEN'),
    chaveCifra: v('META_TOKEN_ENCRYPTION_KEY'),
    graphVersion: v('META_GRAPH_VERSION'),
    callbackBaseUrl,
  }
}

/** Base fixa do callback: https obrigatório (exceto localhost/127.0.0.1), sem barra final. */
export function validarBaseUrl(valor: string): string {
  let u: URL
  try {
    u = new URL(valor)
  } catch {
    throw new ErroConfigMeta('Configuração da Meta inválida: META_CALLBACK_BASE_URL não é uma URL')
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) {
    throw new ErroConfigMeta('Configuração da Meta inválida: META_CALLBACK_BASE_URL deve usar https')
  }
  return u.origin
}
