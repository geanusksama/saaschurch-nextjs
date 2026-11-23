import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { criarDisparo, validarEntradaDisparo } from '@/lib/meta/servicoEnvio'
import { listarDisparos } from '@/lib/meta/envioConsultas'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasEnvio } from '@/lib/meta/depsEnvio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.envio.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      return json({ disparos: await listarDisparos(user.campoId) })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.envio.criar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const agora = new Date()
    const v = validarEntradaDisparo(corpo, { agora })
    if (!v.ok) return json({ error: v.erros.join(' '), erros: v.erros }, 400)
    try {
      return json(await criarDisparo(await montarDependenciasEnvio(), user.campoId, user.id, corpo, agora), 201)
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
