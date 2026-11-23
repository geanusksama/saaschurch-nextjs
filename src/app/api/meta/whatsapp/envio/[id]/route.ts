import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { pausar, retomar, cancelar } from '@/lib/meta/servicoEnvio'
import { detalheDisparo } from '@/lib/meta/envioConsultas'
import { lerAcaoControle, lerPaginacao, mascararTelefone, statusDoEnvio } from '@/lib/meta/envio'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasEnvio } from '@/lib/meta/depsEnvio'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NAO_ENCONTRADO = 'Disparo não encontrado.'

/** Detalhe paginado (?pagina=1&porPagina=50, máx. 100). Telefone sempre mascarado. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.envio.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    const { id } = await ctx.params
    if (!UUID.test(id)) return json({ error: NAO_ENCONTRADO }, 404)
    const q = req.nextUrl.searchParams
    const { pagina, porPagina } = lerPaginacao(q.get('pagina'), q.get('porPagina'))
    try {
      const d = await detalheDisparo(user.campoId, id, pagina, porPagina)
      if (!d) return json({ error: NAO_ENCONTRADO }, 404)
      return json({
        disparo: d.disparo,
        pagina, porPagina, totalItens: d.totalItens,
        itens: d.itens.map((e) => {
          const status = statusDoEnvio(e.status, e.erroCodigo)
          return {
            id: e.id, nome: e.nome, telefone: mascararTelefone(e.telefone), status,
            // "enviando" não é erro: a marca -1 não sai da API.
            erroCodigo: status === 'enviando' ? null : e.erroCodigo,
            erro: status === 'enviando' ? null : e.erro,
            enviadoEm: e.enviadoEm, atualizadoEm: e.atualizadoEm,
          }
        }),
      })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.envio.controlar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    const { id } = await ctx.params
    if (!UUID.test(id)) return json({ error: NAO_ENCONTRADO }, 404)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const a = lerAcaoControle(corpo)
    if (!a.ok) return json({ error: a.erros.join(' '), erros: a.erros }, 400)
    try {
      const deps = await montarDependenciasEnvio()
      if (a.acao === 'pausar') await pausar(deps, user.campoId, id)
      else if (a.acao === 'retomar') await retomar(deps, user.campoId, id)
      else await cancelar(deps, user.campoId, id)
      const novo = await deps.repo.buscarDisparo(user.campoId, id)
      return json({ ok: true, status: novo?.status ?? null })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
