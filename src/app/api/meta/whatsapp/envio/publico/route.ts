import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { contarPublico, validarFiltros } from '@/lib/meta/servicoEnvio'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasEnvio } from '@/lib/meta/depsEnvio'

export const dynamic = 'force-dynamic'

/** Conta o público dos filtros (`{ filtros }`) sem gravar nada. */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.envio.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const filtros = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>).filtros : undefined
    const erros = validarFiltros(filtros)
    if (erros.length) return json({ error: erros.join(' '), erros }, 400)
    try {
      return json(await contarPublico(await montarDependenciasEnvio(), user.campoId, filtros))
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
