import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { analisarPeriodo, montarRelatorio, resumirConversa } from '@/lib/relatorioAtendimento'

/**
 * Relatórios do atendimento do agente de IA (Caixa do WhatsApp → Relatórios).
 *
 * GET  ?de=AAAA-MM-DD&ate=AAAA-MM-DD&departamento=  → painel do período
 * POST { acao: 'analise', de, ate, departamento }    → relatório escrito pela IA
 * POST { acao: 'resumo', conversationId }             → resumo de uma conversa
 *
 * Só conversas dos agentes do campo ativo e das instâncias que a pessoa acessa.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } })
const DIA = /^\d{4}-\d{2}-\d{2}$/

function periodo(de: unknown, ate: unknown): { de: string; ate: string } | null {
  if (typeof de !== 'string' || typeof ate !== 'string' || !DIA.test(de) || !DIA.test(ate) || de > ate) return null
  // teto de 1 ano por consulta
  if (new Date(ate).getTime() - new Date(de).getTime() > 366 * 86_400_000) return null
  return { de, ate }
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_inbox.whats_app_inbox.relatorios')
    if (negado) return negado
    const sp = new URL(req.url).searchParams
    const p = periodo(sp.get('de'), sp.get('ate'))
    if (!p) return json({ error: 'Período inválido (use datas AAAA-MM-DD, de ≤ até, no máximo 1 ano).' }, 400)
    const rel = await montarRelatorio({
      ...p,
      departamento: sp.get('departamento') || null,
      campoId: user.campoId || null,
      instancias: await getAccessibleInstanceIds(String(user.id), user.profileType),
    })
    return json(rel)
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_inbox.whats_app_inbox.relatorio_ia')
    if (negado) return negado
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const campoId = user.campoId || null
    const instancias = await getAccessibleInstanceIds(String(user.id), user.profileType)
    try {
      if (body.acao === 'resumo') {
        const id = typeof body.conversationId === 'string' ? body.conversationId : ''
        const { data: conv } = await supabaseAdmin.from('whatsapp_conversations').select('id, instance_id').eq('id', id).maybeSingle()
        if (!conv || (instancias && !instancias.has(conv.instance_id))) return json({ error: 'Conversa não encontrada.' }, 404)
        return json({ resumo: await resumirConversa(conv.id, campoId) })
      }
      if (body.acao === 'analise') {
        const p = periodo(body.de, body.ate)
        if (!p) return json({ error: 'Período inválido.' }, 400)
        const departamento = typeof body.departamento === 'string' && body.departamento ? body.departamento : null
        const rel = await montarRelatorio({ ...p, departamento, campoId, instancias })
        if (!rel.conversas.length) return json({ analise: 'Nenhum atendimento no período escolhido.' })
        return json({ analise: await analisarPeriodo(rel, departamento, campoId) })
      }
      return json({ error: 'Ação desconhecida.' }, 400)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Falha ao gerar.' }, 400)
    }
  })
}
