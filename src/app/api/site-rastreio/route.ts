import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { detalhar, montarPainel, type TipoDetalhe } from '@/lib/siteRastreio'

/**
 * GET /api/site-rastreio?de=AAAA-MM-DD&ate=AAAA-MM-DD            → painel
 * GET /api/site-rastreio?...&detalhe=origem|pagina|clique|dia|dispositivo&valor=
 *                                                                 → lista do pedaço clicado
 * Campo ativo filtra tudo (master inclusive).
 */

export const dynamic = 'force-dynamic'
const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } })
const DIA = /^\d{4}-\d{2}-\d{2}$/
const TIPOS: TipoDetalhe[] = ['origem', 'pagina', 'clique', 'dia', 'dispositivo']

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'site_rastreio.view')
    if (negado) return negado
    const sp = new URL(req.url).searchParams
    const de = sp.get('de') ?? ''
    const ate = sp.get('ate') ?? ''
    if (!DIA.test(de) || !DIA.test(ate) || de > ate || new Date(ate).getTime() - new Date(de).getTime() > 366 * 86_400_000) {
      return json({ error: 'Período inválido (datas AAAA-MM-DD, de ≤ até, no máximo 1 ano).' }, 400)
    }
    const campoId = user.campoId || null
    if (!campoId) return json({ error: 'Seu usuário está sem campo ativo.' }, 400)
    try {
      const tipo = sp.get('detalhe') as TipoDetalhe | null
      if (tipo) {
        if (!TIPOS.includes(tipo)) return json({ error: 'Detalhe inválido.' }, 400)
        return json(await detalhar(campoId, de, ate, tipo, sp.get('valor') ?? ''))
      }
      return json(await montarPainel(campoId, de, ate))
    } catch (e) {
      console.error('[site-rastreio]', e)
      return json({ error: 'Falha ao montar o painel.' }, 500)
    }
  })
}
