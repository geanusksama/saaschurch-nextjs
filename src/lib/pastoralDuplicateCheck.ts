/**
 * Antiduplicidade do pipeline pastoral.
 *
 * Os atalhos do portal público (Quero ser Membro, Visita Pastoral, etc.) criavam
 * card novo a cada envio: quem repetia o formulário — ou clicava duas vezes —
 * aparecia duas vezes no kanban. Antes de criar, as rotas públicas passam por
 * aqui para ver se aquele número já tem o MESMO assunto vivo no pipeline.
 *
 * "Vivo" = ainda não concluído nem cancelado e não excluído. Card concluído ou
 * cancelado não bloqueia: a pessoa pode voltar meses depois com o mesmo pedido.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

/** Últimos 8 dígitos — imune a DDI, DDD e ao 9º dígito. */
function phoneTail(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '').slice(-8)
}

export interface ExistingAttendance {
  attendanceId: string
  stage: string
  stageKey: string
  createdAt: string
  title: string | null
}

/**
 * Procura um atendimento vivo do mesmo telefone e do mesmo tipo na igreja.
 * Retorna null quando é seguro criar um card novo.
 */
export async function findLiveAttendance(params: {
  churchId: string
  phone: string
  attendanceType: string | null
}): Promise<ExistingAttendance | null> {
  const tail = phoneTail(params.phone)
  if (tail.length < 8) return null

  let query = supabaseAdmin
    .from('pastoral_attendances')
    .select('id, phone, title, visitor_name, status, column_id, created_at, attendance_type')
    .eq('church_id', params.churchId)
    .is('deleted_at', null)
    // concluído/cancelado libera um novo pedido
    .not('status', 'in', '("done","cancelled")')
    .order('created_at', { ascending: false })
    .limit(200)

  // o bloqueio é sempre por ASSUNTO: quem já pediu "Quero ser Membro" continua
  // podendo abrir uma visita pastoral. Sem tipo, casa só com os outros sem tipo.
  query = params.attendanceType
    ? query.eq('attendance_type', params.attendanceType)
    : query.is('attendance_type', null)

  const { data } = await query

  // o telefone é comparado em JS: a coluna guarda formatos diferentes conforme
  // a origem do card (portal, importação de CSV, digitação manual)
  const match = (data ?? []).find(row => phoneTail(row.phone ?? '') === tail)
  if (!match) return null

  let stage = 'POR FAZER'
  let stageKey = 'todo'
  if (match.column_id) {
    const { data: column } = await supabaseAdmin
      .from('pastoral_pipeline_columns')
      .select('name, column_key')
      .eq('id', match.column_id)
      .maybeSingle()
    if (column) {
      stage = column.name
      stageKey = column.column_key
    }
  }

  return {
    attendanceId: match.id,
    stage,
    stageKey,
    createdAt: match.created_at,
    title: match.title ?? match.visitor_name ?? null,
  }
}

/** Aviso em linguagem de portal, para devolver a quem preencheu o formulário. */
export function duplicateMessage(existing: ExistingAttendance, subject: string): string {
  const since = new Date(existing.createdAt).toLocaleDateString('pt-BR')
  return (
    `Você já tem um pedido de "${subject}" em andamento, aberto em ${since} e ` +
    `atualmente na fase ${existing.stage} do atendimento. ` +
    `Não é preciso enviar de novo — nossa equipe entra em contato em breve.`
  )
}
