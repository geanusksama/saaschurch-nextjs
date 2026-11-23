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
] as const

export async function lerConfigMeta(): Promise<ConfigMeta> {
  const faltando = VARIAVEIS.filter((n) => !(process.env[n] ?? '').trim())
  if (faltando.length) throw new ErroConfigMeta(`Configuração da Meta incompleta: ${faltando.join(', ')}`)
  const v = (n: (typeof VARIAVEIS)[number]) => (process.env[n] as string).trim()
  return {
    appId: v('META_APP_ID'),
    appSecret: v('META_APP_SECRET'),
    configId: v('META_ES_CONFIG_ID'),
    verifyToken: v('META_WEBHOOK_VERIFY_TOKEN'),
    chaveCifra: v('META_TOKEN_ENCRYPTION_KEY'),
    graphVersion: v('META_GRAPH_VERSION'),
  }
}
