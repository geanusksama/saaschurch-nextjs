import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { ehBase } from '@/lib/meta/configCentral'
import { moedaDosPrecos, validarPrecos, LINK_TABELA_OFICIAL } from '@/lib/meta/custo'
import { gravarPrecos, lerPrecosCentrais } from '@/lib/meta/custoRepo'
import { json } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

/** Tabela de preços para as telas (a Meta cobra no cartão do campo; o sistema só estima). Sem preços lidos ⇒ lista vazia ("preço não configurado"). */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const precos = await lerPrecosCentrais().catch(() => [])
    return json({ precos, moeda: moedaDosPrecos(precos), base: ehBase(process.env), link: LINK_TABELA_OFICIAL })
  })
}

/** Master, só no base: grava as linhas enviadas (categoria + moeda). */
export async function PUT(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== 'master') return json({ error: 'Apenas o administrador master pode alterar a tabela de preços.' }, 403)
    const negado = await exigirPermissao(user, 'meta_app.precos.editar')
    if (negado) return negado
    if (!ehBase(process.env)) return json({ error: 'A tabela de preços só pode ser alterada no sistema base.' }, 409)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const v = validarPrecos(corpo)
    if (!v.ok) return json({ error: v.erro }, 400)
    try {
      await gravarPrecos(v.precos, user.id)
    } catch (e) {
      console.error('[meta/precos] erro ao gravar:', (e as Error)?.name)
      return json({ error: 'Não foi possível salvar a tabela de preços.' }, 500)
    }
    const precos = await lerPrecosCentrais()
    return json({ precos, moeda: moedaDosPrecos(precos), base: true, link: LINK_TABELA_OFICIAL })
  })
}
