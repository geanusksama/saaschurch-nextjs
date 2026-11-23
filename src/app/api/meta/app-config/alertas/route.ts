import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { listarAbertos } from '@/lib/meta/alertasRepo'
import { json } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

/** Master: alertas não resolvidos do monitor diário. */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== 'master') return json({ error: 'Apenas o administrador master pode ver os alertas.' }, 403)
    const negado = await exigirPermissao(user, 'meta_app.view')
    if (negado) return negado
    try {
      return json({ alertas: await listarAbertos() })
    } catch (e) {
      const cod = (e as { code?: string })?.code
      if (cod === 'P2021' || /does not exist/i.test((e as Error)?.message ?? '')) return json({ alertas: [] }) // tabela ainda não criada
      console.error('[meta/alertas] erro ao listar:', (e as Error)?.name)
      return json({ error: 'Não foi possível carregar os alertas.' }, 500)
    }
  })
}
