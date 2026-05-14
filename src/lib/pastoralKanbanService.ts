/**
 * Pastoral Kanban Service
 *
 * ATENÇÃO: Este módulo é 100% independente do pipeline da Secretaria/CRM.
 * Usa exclusivamente as tabelas:
 *   - pastoral_pipelines
 *   - pastoral_pipeline_columns
 *   - pastoral_attendances
 *   - pastoral_attendance_activities
 *   - pastoral_attendance_notes
 *   - pastoral_attendance_timeline
 *   - pastoral_attendance_files
 *   - pastoral_tags
 *
 * NÃO utiliza: crm_pipelines, crm_stages, kanban_cards, leads, ou qualquer
 * tabela do módulo de Secretaria/CRM.
 */

import { supabase } from './supabaseClient';
import { getCurrentChurchId } from './pastoralService';

export { getCurrentChurchId };

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AttendanceType =
  | 'visita_pastoral'
  | 'aconselhamento'
  | 'discipulado'
  | 'pedido_oracao'
  | 'followup'
  | 'emergencial'
  | 'reconciliacao'
  | 'familiar'
  | 'jovem'
  | 'infantil'
  | 'financeiro'
  | 'ministerial'
  | 'online'
  | 'presencial';

export type ColumnKey = 'todo' | 'doing' | 'done' | 'cancelled';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export type PastoralPipelineColumn = {
  id: string;
  pipeline_id: string;
  church_id: string;
  name: string;
  position: number;
  color: string;
  icon: string | null;
  fixed_column: boolean;
  column_key: ColumnKey;
};

export type PastoralAttendance = {
  id: string;
  church_id: string;
  pipeline_id: string | null;
  column_id: string | null;
  member_id: string | null;
  visitor_name: string | null;
  phone: string | null;
  email: string | null;
  attendance_type: AttendanceType;
  responsible_user_id: string | null;
  priority: Priority;
  status: string;
  title: string | null;
  sla_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  tags: string[];
  is_starred: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joins
  members?: { full_name: string | null; photo_url?: string | null } | null;
  users?: { full_name: string | null } | null;
  churches?: { name: string } | null;
  // computed
  activities_count?: number;
  pending_activities?: number;
};

export type PastoralActivity = {
  id: string;
  attendance_id: string;
  church_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  duration_minutes: number | null;
  responsible_user_id: string | null;
  meeting_link: string | null;
  location: string | null;
  completed: boolean;
  completed_at: string | null;
  priority: string;
  created_by: string | null;
  created_at: string;
  users?: { full_name: string | null } | null;
};

export type PastoralNote = {
  id: string;
  attendance_id: string;
  church_id: string;
  content: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  users?: { full_name: string | null } | null;
};

export type PastoralTimelineEntry = {
  id: string;
  attendance_id: string;
  church_id: string;
  event_type: string;
  description: string;
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  users?: { full_name: string | null } | null;
};

// ─── Pipeline Setup ──────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: Array<{ name: string; position: number; color: string; column_key: ColumnKey; icon: string }> = [
  { name: 'POR FAZER', position: 0, color: '#94a3b8', column_key: 'todo',      icon: 'circle' },
  { name: 'FAZENDO',   position: 1, color: '#3b82f6', column_key: 'doing',     icon: 'loader' },
  { name: 'CONCLUÍDO', position: 2, color: '#22c55e', column_key: 'done',      icon: 'check-circle' },
  { name: 'CANCELADO', position: 3, color: '#ef4444', column_key: 'cancelled', icon: 'x-circle' },
];

/**
 * Retorna o pipeline pastoral da igreja, criando um padrão se não existir.
 */
export async function getOrCreatePastoralPipeline(churchId: string) {
  // Busca pipeline existente
  const { data: existing, error } = await supabase
    .from('pastoral_pipelines')
    .select('id, name, active')
    .eq('church_id', churchId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;

  if (existing) return existing;

  // Cria pipeline padrão
  const { data: pipeline, error: createError } = await supabase
    .from('pastoral_pipelines')
    .insert({ church_id: churchId, name: 'Atendimento Pastoral', active: true })
    .select('id, name, active')
    .single();

  if (createError) throw createError;

  // Cria 4 colunas fixas
  const { error: colError } = await supabase
    .from('pastoral_pipeline_columns')
    .insert(
      DEFAULT_COLUMNS.map((col) => ({
        pipeline_id: pipeline.id,
        church_id: churchId,
        ...col,
        fixed_column: true,
      })),
    );

  if (colError) throw colError;

  return pipeline;
}

/**
 * Busca colunas do pipeline pastoral da igreja.
 */
export async function listPastoralColumns(churchId: string): Promise<PastoralPipelineColumn[]> {
  await getOrCreatePastoralPipeline(churchId);

  const { data, error } = await supabase
    .from('pastoral_pipeline_columns')
    .select('*')
    .eq('church_id', churchId)
    .order('position', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralPipelineColumn[];
}

// ─── Atendimentos (Cards) ────────────────────────────────────────────────────

export async function listPastoralAttendances(params: {
  churchId: string;
  columnId?: string;
  search?: string;
  attendanceType?: AttendanceType | 'all';
  responsibleId?: string;
  priority?: Priority | 'all';
}): Promise<PastoralAttendance[]> {
  const { churchId, columnId, search = '', attendanceType = 'all', responsibleId, priority = 'all' } = params;

  let query = supabase
    .from('pastoral_attendances')
    .select('*, members(full_name, photo_url), users!pastoral_attendances_responsible_user_id_fkey(full_name), churches(name)')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (columnId) query = query.eq('column_id', columnId);
  if (attendanceType !== 'all') query = query.eq('attendance_type', attendanceType);
  if (responsibleId) query = query.eq('responsible_user_id', responsibleId);
  if (priority !== 'all') query = query.eq('priority', priority);

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.or(`visitor_name.ilike.%${s}%,title.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralAttendance[];
}

export async function createPastoralAttendance(input: {
  churchId: string;
  columnId: string;
  pipelineId?: string | null;
  memberId?: string | null;
  visitorName?: string;
  phone?: string;
  email?: string;
  attendanceType: AttendanceType;
  responsibleUserId?: string | null;
  priority?: Priority;
  title?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  slaDate?: string;
  createdBy?: string | null;
}): Promise<PastoralAttendance> {
  const { data, error } = await supabase
    .from('pastoral_attendances')
    .insert({
      church_id: input.churchId,
      column_id: input.columnId,
      pipeline_id: input.pipelineId ?? null,
      member_id: input.memberId || null,
      visitor_name: input.visitorName || null,
      phone: input.phone || null,
      email: input.email || null,
      attendance_type: input.attendanceType,
      responsible_user_id: input.responsibleUserId || null,
      priority: input.priority || 'normal',
      status: 'open',
      title: input.title || null,
      notes: input.notes || input.description || null,
      tags: input.tags || [],
      sla_date: input.slaDate || null,
      started_at: new Date().toISOString(),
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('*, members(full_name, photo_url), users!pastoral_attendances_responsible_user_id_fkey(full_name), churches(name)')
    .single();

  if (error) throw error;

  // Registrar timeline
  await addTimelineEntry({
    attendanceId: data.id,
    churchId: input.churchId,
    eventType: 'created',
    description: 'Atendimento criado',
    createdBy: input.createdBy || null,
  }).catch(() => {});

  return data as PastoralAttendance;
}

export async function movePastoralAttendance(params: {
  attendanceId: string;
  targetColumnId: string;
  targetColumnKey: ColumnKey;
  newPosition?: number;
  churchId: string;
  movedBy?: string | null;
  targetColumnName?: string;
}): Promise<void> {
  const statusMap: Record<ColumnKey, string> = {
    todo: 'open',
    doing: 'doing',
    done: 'done',
    cancelled: 'cancelled',
  };

  const patch: Record<string, any> = {
    column_id: params.targetColumnId,
    status: statusMap[params.targetColumnKey],
    updated_by: params.movedBy || null,
  };

  if (params.newPosition !== undefined) patch.position = params.newPosition;
  if (params.targetColumnKey === 'done') patch.completed_at = new Date().toISOString();
  if (params.targetColumnKey === 'cancelled') patch.cancelled_at = new Date().toISOString();
  if (params.targetColumnKey === 'doing' && !patch.started_at) patch.started_at = new Date().toISOString();

  const { error } = await supabase
    .from('pastoral_attendances')
    .update(patch)
    .eq('id', params.attendanceId);

  if (error) throw error;

  await addTimelineEntry({
    attendanceId: params.attendanceId,
    churchId: params.churchId,
    eventType: 'moved',
    description: `Movido para ${params.targetColumnName || params.targetColumnKey}`,
    createdBy: params.movedBy || null,
  }).catch(() => {});
}

export async function updatePastoralAttendance(
  attendanceId: string,
  patch: Partial<{
    visitor_name: string;
    phone: string;
    email: string;
    attendance_type: AttendanceType;
    responsible_user_id: string | null;
    priority: Priority;
    title: string;
    notes: string;
    tags: string[];
    sla_date: string | null;
    cancel_reason: string | null;
    is_starred: boolean;
    updated_by: string | null;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendances')
    .update(patch)
    .eq('id', attendanceId);

  if (error) throw error;
}

export async function getPastoralAttendanceById(attendanceId: string): Promise<PastoralAttendance | null> {
  const { data, error } = await supabase
    .from('pastoral_attendances')
    .select('*, members(full_name, photo_url), users!pastoral_attendances_responsible_user_id_fkey(full_name), churches(name)')
    .eq('id', attendanceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as PastoralAttendance;
}

// ─── Atividades ──────────────────────────────────────────────────────────────

export async function listPastoralActivities(attendanceId: string): Promise<PastoralActivity[]> {
  const { data, error } = await supabase
    .from('pastoral_attendance_activities')
    .select('*, users!pastoral_attendance_activities_responsible_user_id_fkey(full_name)')
    .eq('attendance_id', attendanceId)
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralActivity[];
}

export async function createPastoralActivity(input: {
  attendanceId: string;
  churchId: string;
  activityType: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  responsibleUserId?: string | null;
  meetingLink?: string;
  location?: string;
  priority?: string;
  createdBy?: string | null;
}): Promise<PastoralActivity> {
  const { data, error } = await supabase
    .from('pastoral_attendance_activities')
    .insert({
      attendance_id: input.attendanceId,
      church_id: input.churchId,
      activity_type: input.activityType,
      title: input.title,
      description: input.description || null,
      scheduled_date: input.scheduledDate || null,
      duration_minutes: input.durationMinutes || null,
      responsible_user_id: input.responsibleUserId || null,
      meeting_link: input.meetingLink || null,
      location: input.location || null,
      priority: input.priority || 'normal',
      completed: false,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('*, users!pastoral_attendance_activities_responsible_user_id_fkey(full_name)')
    .single();

  if (error) throw error;

  await addTimelineEntry({
    attendanceId: input.attendanceId,
    churchId: input.churchId,
    eventType: 'activity',
    description: `Atividade criada: ${input.title}`,
    createdBy: input.createdBy || null,
  }).catch(() => {});

  return data as PastoralActivity;
}

export async function completePastoralActivity(activityId: string, updatedBy?: string | null): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendance_activities')
    .update({ completed: true, completed_at: new Date().toISOString(), updated_by: updatedBy || null })
    .eq('id', activityId);

  if (error) throw error;
}

// ─── Notas ───────────────────────────────────────────────────────────────────

export async function listPastoralNotes(attendanceId: string): Promise<PastoralNote[]> {
  const { data, error } = await supabase
    .from('pastoral_attendance_notes')
    .select('*, users:created_by(full_name)')
    .eq('attendance_id', attendanceId)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralNote[];
}

export async function createPastoralNote(input: {
  attendanceId: string;
  churchId: string;
  content: string;
  isPinned?: boolean;
  createdBy?: string | null;
}): Promise<PastoralNote> {
  const { data, error } = await supabase
    .from('pastoral_attendance_notes')
    .insert({
      attendance_id: input.attendanceId,
      church_id: input.churchId,
      content: input.content,
      is_pinned: input.isPinned || false,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('*')
    .single();

  if (error) throw error;

  await addTimelineEntry({
    attendanceId: input.attendanceId,
    churchId: input.churchId,
    eventType: 'note',
    description: 'Nota adicionada',
    createdBy: input.createdBy || null,
  }).catch(() => {});

  return data as PastoralNote;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export async function addTimelineEntry(input: {
  attendanceId: string;
  churchId: string;
  eventType: string;
  description: string;
  metadata?: Record<string, any>;
  createdBy?: string | null;
}): Promise<void> {
  await supabase
    .from('pastoral_attendance_timeline')
    .insert({
      attendance_id: input.attendanceId,
      church_id: input.churchId,
      event_type: input.eventType,
      description: input.description,
      metadata: input.metadata || null,
      created_by: input.createdBy || null,
    });
}

export async function listPastoralTimeline(attendanceId: string): Promise<PastoralTimelineEntry[]> {
  const { data, error } = await supabase
    .from('pastoral_attendance_timeline')
    .select('*, users:created_by(full_name)')
    .eq('attendance_id', attendanceId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralTimelineEntry[];
}

// ─── Dashboard Summary ───────────────────────────────────────────────────────

export async function getPastoralKanbanSummary(churchId: string) {
  const { data, error } = await supabase
    .from('pastoral_attendances')
    .select('id, status, priority, sla_date, created_at')
    .eq('church_id', churchId)
    .is('deleted_at', null);

  if (error) {
    if (error.code === '42P01') return { open: 0, doing: 0, done: 0, cancelled: 0, overdue: 0, urgent: 0 };
    throw error;
  }

  const rows = data || [];
  const now = new Date();

  return {
    open: rows.filter((r) => r.status === 'open').length,
    doing: rows.filter((r) => r.status === 'doing').length,
    done: rows.filter((r) => r.status === 'done').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    overdue: rows.filter((r) => r.sla_date && new Date(r.sla_date) < now && r.status !== 'done' && r.status !== 'cancelled').length,
    urgent: rows.filter((r) => r.priority === 'urgent' && r.status !== 'done' && r.status !== 'cancelled').length,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  visita_pastoral: 'Visita Pastoral',
  aconselhamento: 'Aconselhamento',
  discipulado: 'Discipulado',
  pedido_oracao: 'Pedido de Oração',
  followup: 'Follow-up',
  emergencial: 'Atendimento Emergencial',
  reconciliacao: 'Reconciliação',
  familiar: 'Atendimento Familiar',
  jovem: 'Atendimento Jovem',
  infantil: 'Atendimento Infantil',
  financeiro: 'Atendimento Financeiro',
  ministerial: 'Atendimento Ministerial',
  online: 'Atendimento Online',
  presencial: 'Atendimento Presencial',
};

export const ATTENDANCE_TYPE_COLORS: Record<AttendanceType, string> = {
  visita_pastoral: '#3b82f6',
  aconselhamento: '#8b5cf6',
  discipulado: '#f59e0b',
  pedido_oracao: '#ec4899',
  followup: '#06b6d4',
  emergencial: '#ef4444',
  reconciliacao: '#22c55e',
  familiar: '#f97316',
  jovem: '#6366f1',
  infantil: '#84cc16',
  financeiro: '#14b8a6',
  ministerial: '#a855f7',
  online: '#64748b',
  presencial: '#0ea5e9',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#94a3b8',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  agendamento: 'Agendamento',
  ligacao: 'Ligação',
  videochamada: 'Videochamada',
  reuniao: 'Reunião',
  visita: 'Visita',
  retorno: 'Retorno',
  oracao: 'Oração',
  followup: 'Follow-up',
  task: 'Tarefa',
  pendencia: 'Pendência',
};

// ─── Participantes ────────────────────────────────────────────────────────────

export type ParticipantRole = 'atendido' | 'pastor' | 'lider' | 'testemunha' | 'visitante';

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  atendido: 'Pessoa Atendida',
  pastor: 'Pastor',
  lider: 'Líder',
  testemunha: 'Testemunha',
  visitante: 'Visitante',
};

export type PastoralParticipant = {
  id: string;
  attendance_id: string;
  church_id: string;
  member_id: string | null;
  user_id: string | null;
  role: ParticipantRole;
  notes: string | null;
  created_at: string;
  members?: { full_name: string | null; photo_url?: string | null } | null;
  users?: { full_name: string | null } | null;
};

export async function listPastoralParticipants(attendanceId: string): Promise<PastoralParticipant[]> {
  const { data, error } = await supabase
    .from('pastoral_attendance_participants')
    .select('*, members(full_name, photo_url), users!pastoral_attendance_participants_user_id_fkey(full_name)')
    .eq('attendance_id', attendanceId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralParticipant[];
}

export async function addPastoralParticipant(input: {
  attendanceId: string;
  churchId: string;
  memberId?: string | null;
  userId?: string | null;
  role: ParticipantRole;
  notes?: string;
  createdBy?: string | null;
}): Promise<PastoralParticipant> {
  const { data, error } = await supabase
    .from('pastoral_attendance_participants')
    .insert({
      attendance_id: input.attendanceId,
      church_id: input.churchId,
      member_id: input.memberId || null,
      user_id: input.userId || null,
      role: input.role,
      notes: input.notes || null,
      created_by: input.createdBy || null,
    })
    .select('*, members(full_name, photo_url)')
    .single();

  if (error) throw error;
  return data as PastoralParticipant;
}

export async function removePastoralParticipant(participantId: string): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendance_participants')
    .delete()
    .eq('id', participantId);

  if (error) throw error;
}

// ─── Note / Activity delete & update ────────────────────────────────────────

export async function deletePastoralNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendance_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId);
  if (error) throw error;
}

export async function updatePastoralNote(noteId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendance_notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', noteId);
  if (error) throw error;
}

export async function deletePastoralActivity(activityId: string): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendance_activities')
    .delete()
    .eq('id', activityId);
  if (error) throw error;
}

export async function updatePastoralActivity(
  activityId: string,
  patch: { title?: string; description?: string; scheduled_date?: string | null; duration_minutes?: number | null; priority?: string; activity_type?: string },
): Promise<void> {
  const { error } = await supabase
    .from('pastoral_attendance_activities')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', activityId);
  if (error) throw error;
}

