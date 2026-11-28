import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { conectar, desconectar, obterStatusDoCampo } from '@/lib/meta/servicoConexao'
import { ehBase } from '@/lib/meta/configCentral'
import * as repo from '@/lib/meta/conexaoRepo'
import { lerTeto, lerTetoDoCampo, contarEnviadosNoMes, gravarTetoDoCampo } from '@/lib/meta/tetoMensal'
import { json, montarDependencias, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      const status = await obterStatusDoCampo(repo, montarDependencias, user.campoId)
      if (!(status as { conectado?: boolean }).conectado) return json(status)
      const [tetoMensal, enviadosNoMes] = await Promise.all([
        lerTetoDoCampo(user.campoId),
        contarEnviadosNoMes(user.campoId, new Date()),
      ])
      return json({ ...status, tetoMensal, enviadosNoMes })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

/** Teto mensal de mensagens do número oficial do campo (vazio = sem teto). */
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.conexao.teto')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    let corpo: { tetoMensal?: unknown } = {}
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const teto = lerTeto(corpo?.tetoMensal)
    if (teto === undefined) return json({ error: 'Informe um número inteiro maior que zero, ou deixe vazio para não ter teto.' }, 400)
    try {
      if (!(await gravarTetoDoCampo(user.campoId, teto))) return json({ error: 'Conecte o número oficial antes de definir o teto.' }, 404)
      return json({ tetoMensal: teto })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.conexao.conectar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    let corpo: { code?: unknown; wabaId?: unknown; phoneNumberId?: unknown } = {}
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    try {
      const r = await conectar(await montarDependencias(), {
        campoId: user.campoId,
        userId: user.id,
        ehMaster: user.profileType === 'master' && ehBase(process.env),
        code: corpo?.code,
        wabaId: corpo?.wabaId,
        phoneNumberId: corpo?.phoneNumberId,
      })
      return json(r, 201)
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.conexao.desconectar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      return json(await desconectar(await montarDependencias(), user.campoId))
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
