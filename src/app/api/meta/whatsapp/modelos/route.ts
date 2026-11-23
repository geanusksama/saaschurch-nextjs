import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import * as conexaoRepo from '@/lib/meta/conexaoRepo'
import * as modelosRepo from '@/lib/meta/modelosRepo'
import { criarModelo } from '@/lib/meta/servicoModelos'
import { normalizarRascunho, validarRascunho, type RascunhoModelo } from '@/lib/meta/modelos'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasModelos } from '@/lib/meta/depsModelos'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      const c = await conexaoRepo.buscarConexaoDoCampo(user.campoId)
      if (!c || c.status === 'desconectado') return json({ modelos: [], conectado: false })
      return json({ modelos: await modelosRepo.listar(user.campoId), conectado: true })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

/** Forma do corpo (normalizarRascunho) e depois as regras da Meta (validarRascunho). */
function lerRascunho(b: unknown): { erros: string[] } | { rascunho: RascunhoModelo } {
  const n = normalizarRascunho(b)
  if ('erros' in n) return n
  const regras = validarRascunho(n.rascunho)
  return regras.length ? { erros: regras } : n
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.criar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const l = lerRascunho(corpo)
    if ('erros' in l) return json({ error: l.erros.join(' '), erros: l.erros }, 400)
    try {
      return json(await criarModelo(await montarDependenciasModelos(), user.campoId, user.id, l.rascunho), 201)
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
