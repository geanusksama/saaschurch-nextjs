import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { sincronizarModelos } from '@/lib/meta/servicoModelos'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasModelos } from '@/lib/meta/depsModelos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      return json(await sincronizarModelos(await montarDependenciasModelos(), user.campoId))
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
