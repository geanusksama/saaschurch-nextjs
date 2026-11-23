import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { excluirModelo } from '@/lib/meta/servicoModelos'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasModelos } from '@/lib/meta/depsModelos'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.excluir')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    const { id } = await ctx.params
    if (!UUID.test(id)) return json({ error: 'Modelo não encontrado.' }, 404)
    try {
      await excluirModelo(await montarDependenciasModelos(), user.campoId, id)
      return json({ ok: true })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
