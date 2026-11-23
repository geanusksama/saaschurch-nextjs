import { mesclarComEnv } from './configCentral'
/**
 * Configuração da Meta (WhatsApp Oficial): valores do app vêm da configuração central
 * (banco do base ou rota do base), com variáveis de ambiente como reserva.
 */
export type ConfigMeta = {
  appId: string
  appSecret: string
  configId: string
  verifyToken: string
  chaveCifra: string
  graphVersion: string
  callbackBaseUrl: string
  /** Interruptor do master: false ⇒ igrejas veem "Em breve". */
  conexaoLiberada: boolean
}

export class ErroConfigMeta extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroConfigMeta'
  }
}

export async function lerConfigMeta(): Promise<ConfigMeta> {
  const env = process.env
  // Import tardio: o módulo padrão carrega o Prisma, que os testes unitários não usam.
  const { configCentral } = await import('./configCentralPadrao')
  const m = mesclarComEnv(await configCentral.lerCentral(), env)
  const dados: Record<string, string> = {
    META_APP_ID: m.appId,
    META_APP_SECRET: m.appSecret,
    META_ES_CONFIG_ID: m.configId,
    META_WEBHOOK_VERIFY_TOKEN: m.verifyToken,
    META_GRAPH_VERSION: m.graphVersion,
    // Por implantação (cada igreja cifra seus tokens e tem sua URL).
    META_TOKEN_ENCRYPTION_KEY: (env.META_TOKEN_ENCRYPTION_KEY ?? '').trim(),
    META_CALLBACK_BASE_URL: (env.META_CALLBACK_BASE_URL ?? '').trim(),
  }
  const faltando = Object.keys(dados).filter((n) => !dados[n])
  if (faltando.length) throw new ErroConfigMeta(`Configuração da Meta incompleta: ${faltando.join(', ')}`)
  return {
    appId: dados.META_APP_ID,
    appSecret: dados.META_APP_SECRET,
    configId: dados.META_ES_CONFIG_ID,
    verifyToken: dados.META_WEBHOOK_VERIFY_TOKEN,
    chaveCifra: dados.META_TOKEN_ENCRYPTION_KEY,
    graphVersion: dados.META_GRAPH_VERSION,
    callbackBaseUrl: validarBaseUrl(dados.META_CALLBACK_BASE_URL),
    conexaoLiberada: m.conexaoLiberada,
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
