import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { ehBase, validarAtualizacao } from '@/lib/meta/configCentral'
import { buscarAberto, resolverAlerta, aprovarEResolver } from '@/lib/meta/alertasRepo'
import { atualizacaoDaProposta } from '@/lib/meta/monitorMeta'
import { json } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

/** Master: { acao: 'resolver' | 'aprovar' }. Aprovar aplica a proposta pelo mesmo caminho do PUT da config. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== 'master') return json({ error: 'Apenas o administrador master pode tratar os alertas.' }, 403)
    const negado = await exigirPermissao(user, 'meta_app.config.editar')
    if (negado) return negado
    const { id } = await ctx.params
    let corpo: { acao?: unknown }
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    if (corpo?.acao !== 'resolver' && corpo?.acao !== 'aprovar') return json({ error: 'Ação inválida.' }, 400)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Alerta inválido.' }, 400)
    try {
      const alerta = await buscarAberto(id)
      if (!alerta) return json({ error: 'Alerta não encontrado ou já resolvido.' }, 404)
      if (corpo.acao === 'aprovar') {
        const atualizacao = atualizacaoDaProposta(alerta.proposta)
        if (!atualizacao) return json({ error: 'Este alerta não tem proposta para aprovar.' }, 400)
        if (!ehBase(process.env)) return json({ error: 'A configuração só pode ser alterada no sistema base.' }, 409)
        const v = validarAtualizacao(atualizacao)
        if (!v.ok) return json({ error: v.erro }, 400)
        await aprovarEResolver(v.dados, id, user.id)
        return json({ ok: true })
      }
      await resolverAlerta(id, user.id)
      return json({ ok: true })
    } catch (e) {
      console.error('[meta/alertas] erro:', (e as Error)?.name)
      return json({ error: 'Não foi possível processar o alerta.' }, 500)
    }
  })
}
