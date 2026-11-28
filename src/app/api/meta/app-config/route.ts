import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { cifrar } from '@/lib/meta/cifra'
import { ehBase, mesclarComEnv, validarAtualizacao, visaoPublica } from '@/lib/meta/configCentral'
import { lerLinha, gravarLinha } from '@/lib/meta/configCentralRepo'
import { configCentral } from '@/lib/meta/configCentralPadrao'
import { json } from '@/lib/meta/depsConexao'
import { lerPrecosDoBanco } from '@/lib/meta/custoRepo'

export const dynamic = 'force-dynamic'

const hash = (v: string) => crypto.createHash('sha256').update(v).digest()

/** Servidor-a-servidor: só no base, com segredo compartilhado. Devolve o segredo do app. */
export async function GET(req: NextRequest) {
  const esperado = (process.env.META_CONFIG_SYNC_TOKEN ?? '').trim()
  const recebido = req.headers.get('x-meta-config-token') ?? ''
  if (!esperado || !crypto.timingSafeEqual(hash(esperado), hash(recebido))) {
    return json({ error: 'Não autorizado.' }, 401)
  }
  if (!ehBase(process.env)) return json({ error: 'Este sistema não é o base da configuração.' }, 404)
  try {
    const c = mesclarComEnv(await configCentral.lerCentral(), process.env)
    const precos = await lerPrecosDoBanco().catch(() => [])
    return json({
      precos,
      appId: c.appId, configId: c.configId, graphVersion: c.graphVersion,
      verifyToken: c.verifyToken, appSecret: c.appSecret, conexaoLiberada: c.conexaoLiberada,
    })
  } catch {
    return json({ error: 'Configuração central indisponível.' }, 503)
  }
}

/** Master: altera os campos enviados. O segredo só é trocado se vier preenchido. */
export async function PUT(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== 'master') return json({ error: 'Apenas o administrador master pode alterar esta configuração.' }, 403)
    const negado = await exigirPermissao(user, 'meta_app.config.editar')
    if (negado) return negado
    if (!ehBase(process.env)) return json({ error: 'A configuração só pode ser alterada no sistema base.' }, 409)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const v = validarAtualizacao(corpo)
    if (!v.ok) return json({ error: v.erro }, 400)
    const { appSecret, ...resto } = v.dados
    const dados: Parameters<typeof gravarLinha>[0] = { ...resto }
    if (appSecret) {
      const chave = (process.env.META_TOKEN_ENCRYPTION_KEY ?? '').trim()
      if (!chave) return json({ error: 'META_TOKEN_ENCRYPTION_KEY não configurada neste sistema.' }, 503)
      dados.appSecretCifrado = cifrar(appSecret, chave)
    }
    try {
      await gravarLinha(dados, user.id)
    } catch (e) {
      console.error('[meta/app-config] erro ao gravar:', (e as Error)?.name)
      return json({ error: 'Não foi possível salvar a configuração.' }, 500)
    }
    return json(visaoPublica(await lerLinha(), process.env))
  })
}
