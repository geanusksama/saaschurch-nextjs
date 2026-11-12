/**
 * Pedidos que um número de WhatsApp já fez à igreja (pipeline pastoral):
 * Quero ser Membro, visita pastoral, pedido de oração etc.
 *
 * O agente de recepção usa para não abrir pedido repetido e para mandar à
 * pessoa os mesmos links que a home manda:
 *  - acompanhamento: /pastoral/timeline/{attendanceId} (PastoralTimelinePublic)
 *  - ficha de adesão: /membro/formulario/{form_token}, enquanto não preenchida
 *
 * Telefone comparado pelos últimos 8 dígitos, a mesma regra de
 * pastoralDuplicateCheck (a coluna guarda formatos diferentes por origem).
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { publicBaseUrl } from '@/lib/publicUrl'
import { SERVICOS_HOME } from '@/lib/servicosHome'

export interface PedidoDoContato {
  attendanceId: string
  tipo: string
  tipoRotulo: string
  aberto: boolean
  fase: string
  criadoEm: string
  linkAcompanhamento: string
  /** só Quero ser Membro com a ficha ainda não preenchida */
  linkFicha: string | null
}

const tail8 = (phone: string) => String(phone ?? '').replace(/\D/g, '').slice(-8)

function rotuloTipo(tipo: string | null): string {
  if (!tipo) return 'Atendimento'
  if (tipo === 'quero_ser_membro') return 'Quero ser Membro'
  return SERVICOS_HOME.find(s => s.id === tipo)?.label ?? tipo
}

export async function pedidosDoContato(telefone: string): Promise<PedidoDoContato[]> {
  const tail = tail8(telefone)
  if (tail.length < 8) return []
  const base = publicBaseUrl()

  try {
    // pré-filtro no banco pelos 4 últimos dígitos (contíguos em qualquer
    // formato salvo), conferência exata dos 8 em JS
    const { data } = await supabaseAdmin
      .from('pastoral_attendances')
      .select('id, phone, attendance_type, status, column_id, created_at')
      .is('deleted_at', null)
      .ilike('phone', `%${tail.slice(-4)}`)
      .order('created_at', { ascending: false })
      .limit(50)

    const meus = (data ?? []).filter(r => tail8(r.phone ?? '') === tail).slice(0, 5)
    if (!meus.length) return []

    const colunaIds = [...new Set(meus.map(r => r.column_id).filter(Boolean))] as string[]
    const { data: colunas } = colunaIds.length
      ? await supabaseAdmin.from('pastoral_pipeline_columns').select('id, name').in('id', colunaIds)
      : { data: [] as { id: string; name: string }[] }
    const faseDe = new Map((colunas ?? []).map(c => [c.id, c.name]))

    const { data: fichas } = await supabaseAdmin
      .from('new_member_requests')
      .select('pipeline_card_id, form_token, form_submitted_at')
      .in('pipeline_card_id', meus.map(r => r.id))
    const fichaDe = new Map((fichas ?? []).map(f => [f.pipeline_card_id, f]))

    return meus.map(r => {
      const ficha = fichaDe.get(r.id)
      const aberto = r.status !== 'done' && r.status !== 'cancelled'
      return {
        attendanceId: r.id,
        tipo: r.attendance_type ?? '',
        tipoRotulo: rotuloTipo(r.attendance_type),
        aberto,
        fase: (r.column_id && faseDe.get(r.column_id)) || (aberto ? 'em andamento' : r.status === 'done' ? 'concluído' : 'cancelado'),
        criadoEm: String(r.created_at).slice(0, 10),
        linkAcompanhamento: `${base}/pastoral/timeline/${r.id}`,
        linkFicha: ficha?.form_token && !ficha.form_submitted_at ? `${base}/membro/formulario/${ficha.form_token}` : null,
      }
    })
  } catch (err) {
    console.error('[pedidosDoContato]', err)
    return []
  }
}

/** Há Quero ser Membro em aberto? (o agente não abre outro) */
export function temQueroSerMembroAberto(pedidos: PedidoDoContato[]): boolean {
  return pedidos.some(p => p.aberto && p.tipo === 'quero_ser_membro')
}
