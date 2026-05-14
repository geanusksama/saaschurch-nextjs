import { supabase } from './supabaseClient';

export type PrayerCategory =
  | 'saude'
  | 'familia'
  | 'trabalho'
  | 'financas'
  | 'vida_espiritual'
  | 'decisoes'
  | 'libertacao'
  | 'gratidao'
  | 'outro';

export type PrayerRequestRow = {
  id: string;
  church_id: string;
  member_id: string | null;
  requester_name: string | null;
  title: string;
  description: string;
  category: PrayerCategory;
  status: 'active' | 'answered' | 'archived';
  priority: 'normal' | 'urgent';
  visibility: 'public' | 'leadership' | 'private';
  is_anonymous: boolean;
  prayed_count: number;
  comments_count: number;
  testimony_text: string | null;
  created_at: string;
  members?: { full_name: string | null } | null;
};

export type PastoralVisitRow = {
  id: string;
  church_id: string;
  member_id: string | null;
  title: string;
  visit_type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'pending';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  location_name: string | null;
  address: string | null;
  reason: string | null;
  notes: string | null;
  next_steps: string | null;
  responsible_id: string | null;
  created_at: string;
  members?: { full_name: string | null; phone: string | null } | null;
  users?: { full_name: string | null } | null;
};

export type PastoralVisitParticipantRow = {
  id: string;
  role: string;
  users?: { full_name: string | null } | null;
  members?: { full_name: string | null } | null;
};

export type PastoralVisitPrayerPointRow = {
  id: string;
  description: string;
  is_answered: boolean;
};

export type PastoralCounselingRow = {
  id: string;
  church_id: string;
  member_id: string | null;
  counselor_id: string | null;
  title: string;
  counseling_type: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  current_summary: string | null;
  total_sessions: number;
  started_at: string | null;
  next_session_at: string | null;
  members?: { full_name: string | null } | null;
  users?: { full_name: string | null } | null;
};

export type PastoralCounselingSessionRow = {
  id: string;
  counseling_id: string;
  session_number: number;
  session_date: string;
  duration_minutes: number | null;
  notes: string | null;
  private_notes: string | null;
  emotional_state: string | null;
  spiritual_state: string | null;
  progress_level: number | null;
  next_steps: string | null;
  next_session_at: string | null;
};

export type DiscipleshipProgramRow = {
  id: string;
  name: string;
  description: string | null;
  stage: 'fundamentos' | 'crescimento' | 'multiplicacao';
  lessons_count: number;
  color: string | null;
  icon: string | null;
};

export type DiscipleshipRow = {
  id: string;
  church_id: string;
  member_id: string | null;
  discipler_id: string | null;
  program_id: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  started_at: string | null;
  next_meeting_at: string | null;
  current_lesson: number | null;
  total_lessons: number | null;
  progress_percent: number | null;
  notes: string | null;
  members?: { full_name: string | null } | null;
  users?: { full_name: string | null } | null;
  discipleship_programs?: DiscipleshipProgramRow | null;
};

export type DiscipleshipProgramLessonRow = {
  id: string;
  church_id: string;
  program_id: string;
  lesson_number: number;
  title: string;
  content_summary: string | null;
  duration_minutes: number | null;
  materials: string[] | null;
  created_at: string;
};

export type PastoralTimelineRow = {
  id: string;
  church_id: string;
  member_id: string | null;
  type: 'visit' | 'counseling' | 'prayer_request' | 'discipleship' | string;
  title: string;
  description: string | null;
  event_date: string;
  responsible_name: string | null;
  status: string;
  metadata: Record<string, any> | null;
};

export type BasicMemberOption = {
  id: string;
  full_name: string;
  phone: string | null;
  address_city: string | null;
  address_street: string | null;
  address_number: string | null;
};

export type BasicUserOption = {
  id: string;
  full_name: string;
};

export function getCurrentChurchId(): string | null {
  try {
    const raw = localStorage.getItem('mrm_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.churchId || user?.church_id || null;
  } catch {
    return null;
  }
}

export async function listPrayerRequests(params: {
  churchId: string;
  search?: string;
  category?: PrayerCategory | 'all';
  answered?: boolean;
  urgent?: boolean;
}) {
  const { churchId, search = '', category = 'all', answered = false, urgent = false } = params;

  let query = supabase
    .from('prayer_requests')
    .select('id, church_id, member_id, requester_name, title, description, category, status, priority, visibility, is_anonymous, prayed_count, comments_count, testimony_text, created_at, members(full_name)')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
  }

  if (category !== 'all') {
    query = query.eq('category', category);
  }

  if (answered) {
    query = query.eq('status', 'answered');
  }

  if (urgent) {
    query = query.eq('priority', 'urgent');
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as PrayerRequestRow[];
}

export async function getPrayerWallSummary(churchId: string) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('id, status, priority, prayed_count')
    .eq('church_id', churchId)
    .is('deleted_at', null);

  if (error) throw error;

  const rows = data || [];
  return {
    active: rows.filter((r) => r.status === 'active').length,
    answered: rows.filter((r) => r.status === 'answered').length,
    urgent: rows.filter((r) => r.priority === 'urgent' && r.status !== 'answered').length,
    prayers: rows.reduce((sum, r) => sum + Number(r.prayed_count || 0), 0),
  };
}

export async function prayForRequest(params: {
  churchId: string;
  requestId: string;
  userId?: string | null;
  mode: 'prayed' | 'amen';
}) {
  const { churchId, requestId, userId, mode } = params;

  if (userId) {
    const { error: interactionError } = await supabase
      .from('prayer_request_interactions')
      .insert({
        church_id: churchId,
        prayer_request_id: requestId,
        user_id: userId,
        interaction_type: mode,
      });

    if (interactionError && interactionError.code !== '23505') {
      throw interactionError;
    }

    if (interactionError && interactionError.code === '23505') {
      return { duplicated: true };
    }
  }

  const { data: req, error: reqErr } = await supabase
    .from('prayer_requests')
    .select('prayed_count')
    .eq('id', requestId)
    .single();

  if (reqErr) throw reqErr;

  const { error: updErr } = await supabase
    .from('prayer_requests')
    .update({ prayed_count: Number(req?.prayed_count || 0) + 1 })
    .eq('id', requestId);

  if (updErr) throw updErr;

  return { duplicated: false };
}

async function safeCount(table: string, churchId: string, extraFilter?: (query: any) => any) {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('church_id', churchId)
    .is('deleted_at', null);

  if (extraFilter) {
    query = extraFilter(query);
  }

  const { count, error } = await query;

  if (error) {
    // During rollout, migration may not have been applied yet.
    if (error.code === '42P01') return 0;
    throw error;
  }

  return Number(count || 0);
}

export async function getPastoralDashboardSummary(churchId: string) {
  const [visits, counseling, discipleship, prayer] = await Promise.all([
    safeCount('pastoral_visits', churchId, (q) => q.eq('status', 'scheduled')),
    safeCount('pastoral_counselings', churchId, (q) => q.eq('status', 'active')),
    safeCount('discipleships', churchId, (q) => q.eq('status', 'active')),
    getPrayerWallSummary(churchId).catch((error: any) => {
      if (error?.code === '42P01') return { active: 0, answered: 0, urgent: 0, prayers: 0 };
      throw error;
    }),
  ]);

  return {
    scheduledVisits: visits,
    activeCounseling: counseling,
    activePrayerRequests: prayer.active,
    activeDiscipleship: discipleship,
  };
}

export async function listRecentPrayerRequests(churchId: string, limit = 8) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('id, requester_name, title, status, priority, created_at, is_anonymous, members(full_name)')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return data || [];
}

export async function listMemberOptions(churchId: string, search = '') {
  let query = supabase
    .from('members')
    .select('id, full_name, phone, address_city, address_street, address_number')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(50);

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.ilike('full_name', `%${s}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BasicMemberOption[];
}

export async function listUserOptions(churchId: string, search = '') {
  let query = supabase
    .from('users')
    .select('id, full_name')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(50);

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.ilike('full_name', `%${s}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BasicUserOption[];
}

export async function listPastoralVisits(params: {
  churchId: string;
  search?: string;
  status?: 'all' | PastoralVisitRow['status'];
}) {
  const { churchId, search = '', status = 'all' } = params;

  let query = supabase
    .from('pastoral_visits')
    .select('id, church_id, member_id, title, visit_type, status, priority, scheduled_at, completed_at, duration_minutes, location_name, address, reason, notes, next_steps, responsible_id, created_at, members(full_name, phone), users(full_name)')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true, nullsFirst: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.or(`title.ilike.%${s}%,reason.ilike.%${s}%,notes.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralVisitRow[];
}

export async function getPastoralVisitById(visitId: string) {
  const { data, error } = await supabase
    .from('pastoral_visits')
    .select('id, church_id, member_id, title, visit_type, status, priority, scheduled_at, completed_at, duration_minutes, location_name, address, reason, notes, next_steps, responsible_id, created_at, members(full_name, phone), users(full_name)')
    .eq('id', visitId)
    .single();

  if (error) throw error;
  return data as PastoralVisitRow;
}

export async function listVisitParticipants(visitId: string) {
  const { data, error } = await supabase
    .from('pastoral_visit_participants')
    .select('id, role, users(full_name), members(full_name)')
    .eq('visit_id', visitId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralVisitParticipantRow[];
}

export async function listVisitPrayerPoints(visitId: string) {
  const { data, error } = await supabase
    .from('pastoral_visit_prayer_points')
    .select('id, description, is_answered')
    .eq('visit_id', visitId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralVisitPrayerPointRow[];
}

export async function createPastoralVisit(input: {
  churchId: string;
  memberId: string;
  responsibleId: string;
  title: string;
  visitType: PastoralVisitRow['visit_type'];
  scheduledAt: string;
  reason: string;
  address?: string;
  notes?: string;
  durationMinutes?: number;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('pastoral_visits')
    .insert({
      church_id: input.churchId,
      member_id: input.memberId,
      responsible_id: input.responsibleId,
      title: input.title,
      visit_type: input.visitType,
      status: 'scheduled',
      priority: 'normal',
      scheduled_at: input.scheduledAt,
      reason: input.reason,
      address: input.address || null,
      notes: input.notes || null,
      duration_minutes: input.durationMinutes || null,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function updatePastoralVisit(
  visitId: string,
  patch: Partial<{
    title: string;
    status: PastoralVisitRow['status'];
    priority: PastoralVisitRow['priority'];
    completed_at: string | null;
    duration_minutes: number | null;
    location_name: string | null;
    address: string | null;
    reason: string | null;
    notes: string | null;
    next_steps: string | null;
    followup_required: boolean;
    followup_date: string | null;
    updated_by: string | null;
  }>,
) {
  const { error } = await supabase
    .from('pastoral_visits')
    .update(patch)
    .eq('id', visitId);

  if (error) throw error;
}

export async function replaceVisitPrayerPoints(input: {
  churchId: string;
  visitId: string;
  points: string[];
  createdBy?: string | null;
}) {
  const { churchId, visitId, points, createdBy } = input;

  const { error: deleteError } = await supabase
    .from('pastoral_visit_prayer_points')
    .delete()
    .eq('visit_id', visitId);

  if (deleteError) throw deleteError;

  const clean = points.map((point) => point.trim()).filter(Boolean);
  if (!clean.length) return;

  const { error: insertError } = await supabase
    .from('pastoral_visit_prayer_points')
    .insert(
      clean.map((description) => ({
        church_id: churchId,
        visit_id: visitId,
        description,
        created_by: createdBy || null,
        updated_by: createdBy || null,
      })),
    );

  if (insertError) throw insertError;
}

export async function listCounselings(params: {
  churchId: string;
  search?: string;
  status?: 'all' | PastoralCounselingRow['status'];
  type?: 'all' | string;
}) {
  const { churchId, search = '', status = 'all', type = 'all' } = params;

  let query = supabase
    .from('pastoral_counselings')
    .select('id, church_id, member_id, counselor_id, title, counseling_type, status, priority, current_summary, total_sessions, started_at, next_session_at, members(full_name), users(full_name)')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);
  if (type !== 'all') query = query.eq('counseling_type', type);

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.or(`title.ilike.%${s}%,current_summary.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralCounselingRow[];
}

export async function createCounseling(input: {
  churchId: string;
  memberId: string;
  counselorId: string;
  title: string;
  counselingType: string;
  description: string;
  startedAt: string;
  nextSessionAt?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('pastoral_counselings')
    .insert({
      church_id: input.churchId,
      member_id: input.memberId,
      counselor_id: input.counselorId,
      title: input.title,
      counseling_type: input.counselingType,
      description: input.description,
      status: 'active',
      priority: input.priority || 'normal',
      started_at: input.startedAt,
      next_session_at: input.nextSessionAt || null,
      total_sessions: 0,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function listCounselingSessions(counselingId: string) {
  const { data, error } = await supabase
    .from('pastoral_counseling_sessions')
    .select('id, counseling_id, session_number, session_date, duration_minutes, notes, private_notes, emotional_state, spiritual_state, progress_level, next_steps, next_session_at')
    .eq('counseling_id', counselingId)
    .is('deleted_at', null)
    .order('session_number', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data || []) as PastoralCounselingSessionRow[];
}

export async function createCounselingSession(input: {
  churchId: string;
  counselingId: string;
  sessionDate: string;
  durationMinutes?: number;
  notes?: string;
  privateNotes?: string;
  emotionalState?: string;
  spiritualState?: string;
  progressLevel?: number;
  nextSteps?: string;
  nextSessionAt?: string;
  createdBy?: string | null;
}) {
  const sessions = await listCounselingSessions(input.counselingId);
  const nextNumber = sessions.length + 1;

  const { data, error } = await supabase
    .from('pastoral_counseling_sessions')
    .insert({
      church_id: input.churchId,
      counseling_id: input.counselingId,
      session_number: nextNumber,
      session_date: input.sessionDate,
      duration_minutes: input.durationMinutes || null,
      notes: input.notes || null,
      private_notes: input.privateNotes || null,
      emotional_state: input.emotionalState || null,
      spiritual_state: input.spiritualState || null,
      progress_level: input.progressLevel ?? null,
      next_steps: input.nextSteps || null,
      next_session_at: input.nextSessionAt || null,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  const { error: updateError } = await supabase
    .from('pastoral_counselings')
    .update({
      total_sessions: nextNumber,
      next_session_at: input.nextSessionAt || null,
      updated_by: input.createdBy || null,
    })
    .eq('id', input.counselingId);

  if (updateError) throw updateError;
  return data;
}

export async function listDiscipleshipPrograms(churchId: string) {
  const { data, error } = await supabase
    .from('discipleship_programs')
    .select('id, name, description, stage, lessons_count, color, icon')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as DiscipleshipProgramRow[];
}

export async function listDiscipleships(params: {
  churchId: string;
  search?: string;
  status?: 'all' | DiscipleshipRow['status'];
}) {
  const { churchId, search = '', status = 'all' } = params;

  let query = supabase
    .from('discipleships')
    .select('id, church_id, member_id, discipler_id, program_id, status, started_at, next_meeting_at, current_lesson, total_lessons, progress_percent, notes, members(full_name), users(full_name), discipleship_programs(id, name, description, stage, lessons_count, color, icon)')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);

  if (search.trim()) {
    const s = search.trim().replaceAll('%', '');
    query = query.or(`notes.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as DiscipleshipRow[];
}

export async function createDiscipleship(input: {
  churchId: string;
  memberId: string;
  disciplerId: string;
  programId: string;
  startedAt: string;
  nextMeetingAt?: string;
  notes?: string;
  createdBy?: string | null;
}) {
  const { data: program, error: programError } = await supabase
    .from('discipleship_programs')
    .select('lessons_count')
    .eq('id', input.programId)
    .single();

  if (programError) throw programError;

  const totalLessons = Number(program?.lessons_count || 0);

  const { data, error } = await supabase
    .from('discipleships')
    .insert({
      church_id: input.churchId,
      member_id: input.memberId,
      discipler_id: input.disciplerId,
      program_id: input.programId,
      status: 'active',
      started_at: input.startedAt,
      next_meeting_at: input.nextMeetingAt || null,
      current_lesson: 0,
      total_lessons: totalLessons,
      progress_percent: 0,
      notes: input.notes || null,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function createDiscipleshipMeeting(input: {
  churchId: string;
  discipleshipId: string;
  meetingDate: string;
  lessonNumber: number;
  lessonTitle?: string;
  notes?: string;
  homework?: string;
  nextMeetingAt?: string;
  progressPercent?: number;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('discipleship_meetings')
    .insert({
      church_id: input.churchId,
      discipleship_id: input.discipleshipId,
      meeting_date: input.meetingDate,
      lesson_number: input.lessonNumber,
      lesson_title: input.lessonTitle || null,
      notes: input.notes || null,
      homework: input.homework || null,
      next_meeting_at: input.nextMeetingAt || null,
      progress_percent: input.progressPercent ?? null,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  const patch: Record<string, any> = {
    current_lesson: input.lessonNumber,
    updated_by: input.createdBy || null,
  };

  if (typeof input.progressPercent === 'number') {
    patch.progress_percent = Math.max(0, Math.min(100, input.progressPercent));
  }

  if (input.nextMeetingAt) {
    patch.next_meeting_at = input.nextMeetingAt;
  }

  const { error: updateError } = await supabase
    .from('discipleships')
    .update(patch)
    .eq('id', input.discipleshipId);

  if (updateError) throw updateError;
  return data;
}

export async function createDiscipleshipProgram(input: {
  churchId: string;
  name: string;
  description?: string;
  stage: 'fundamentos' | 'crescimento' | 'multiplicacao';
  lessonsCount?: number;
  color?: string;
  icon?: string;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('discipleship_programs')
    .insert({
      church_id: input.churchId,
      name: input.name,
      description: input.description || null,
      stage: input.stage,
      lessons_count: Number(input.lessonsCount || 0),
      color: input.color || null,
      icon: input.icon || null,
      is_active: true,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function listDiscipleshipProgramLessons(programId: string) {
  const { data, error } = await supabase
    .from('discipleship_program_lessons')
    .select('id, church_id, program_id, lesson_number, title, content_summary, duration_minutes, materials, created_at')
    .eq('program_id', programId)
    .is('deleted_at', null)
    .order('lesson_number', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as DiscipleshipProgramLessonRow[];
}

export async function createDiscipleshipProgramLesson(input: {
  churchId: string;
  programId: string;
  lessonNumber: number;
  title: string;
  contentSummary?: string;
  durationMinutes?: number;
  materials?: string[];
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('discipleship_program_lessons')
    .insert({
      church_id: input.churchId,
      program_id: input.programId,
      lesson_number: input.lessonNumber,
      title: input.title,
      content_summary: input.contentSummary || null,
      duration_minutes: input.durationMinutes || null,
      materials: input.materials || [],
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function listPastoralTimeline(params: { churchId: string; memberId?: string }) {
  const { churchId, memberId } = params;

  let query = supabase
    .from('pastoral_timeline')
    .select('id, church_id, member_id, type, title, description, event_date, responsible_name, status, metadata')
    .eq('church_id', churchId)
    .order('event_date', { ascending: false });

  if (memberId) {
    query = query.eq('member_id', memberId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []) as PastoralTimelineRow[];
}

export async function getPastoralReportSummary(params: {
  churchId: string;
  startDate: string;
  endDate: string;
}) {
  const { churchId, startDate, endDate } = params;
  const startISO = `${startDate}T00:00:00`;
  const endISO = `${endDate}T23:59:59`;

  const [visitsRes, counselingRes, prayerRes, discipleshipRes] = await Promise.all([
    supabase
      .from('pastoral_visits')
      .select('id, status, responsible_id, users(full_name)', { count: 'exact' })
      .eq('church_id', churchId)
      .is('deleted_at', null)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    supabase
      .from('pastoral_counselings')
      .select('id, status, counselor_id, users(full_name)', { count: 'exact' })
      .eq('church_id', churchId)
      .is('deleted_at', null)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    supabase
      .from('prayer_requests')
      .select('id, status, category, prayed_count', { count: 'exact' })
      .eq('church_id', churchId)
      .is('deleted_at', null)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    supabase
      .from('discipleships')
      .select('id, status, progress_percent', { count: 'exact' })
      .eq('church_id', churchId)
      .is('deleted_at', null)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
  ]);

  const handled = [visitsRes.error, counselingRes.error, prayerRes.error, discipleshipRes.error].find(
    (error: any) => error && error.code !== '42P01',
  );
  if (handled) throw handled;

  const visits = visitsRes.data || [];
  const counseling = counselingRes.data || [];
  const prayers = prayerRes.data || [];
  const discipleships = discipleshipRes.data || [];

  const visitsByResponsible: Record<string, number> = {};
  visits.forEach((visit: any) => {
    const name = visit.users?.full_name || 'Sem responsável';
    visitsByResponsible[name] = (visitsByResponsible[name] || 0) + 1;
  });

  const prayerByCategory: Record<string, number> = {};
  prayers.forEach((request: any) => {
    const key = request.category || 'outro';
    prayerByCategory[key] = (prayerByCategory[key] || 0) + 1;
  });

  const avgProgress = discipleships.length
    ? Math.round(discipleships.reduce((acc: number, row: any) => acc + Number(row.progress_percent || 0), 0) / discipleships.length)
    : 0;

  return {
    totals: {
      visits: Number(visitsRes.count || visits.length),
      counseling: Number(counselingRes.count || counseling.length),
      prayers: Number(prayerRes.count || prayers.length),
      discipleships: Number(discipleshipRes.count || discipleships.length),
      answeredPrayers: prayers.filter((row: any) => row.status === 'answered').length,
      completedVisits: visits.filter((row: any) => row.status === 'completed').length,
      activeCounseling: counseling.filter((row: any) => row.status === 'active').length,
      completedDiscipleships: discipleships.filter((row: any) => row.status === 'completed').length,
      avgDiscipleshipProgress: avgProgress,
      totalPrayerInteractions: prayers.reduce((acc: number, row: any) => acc + Number(row.prayed_count || 0), 0),
    },
    visitsByResponsible,
    prayerByCategory,
  };
}

export async function createPrayerRequest(input: {
  churchId: string;
  memberId?: string | null;
  requesterName?: string | null;
  title: string;
  description: string;
  category: PrayerCategory;
  priority: 'normal' | 'urgent';
  visibility: 'public' | 'leadership' | 'private';
  isAnonymous: boolean;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from('prayer_requests')
    .insert({
      church_id: input.churchId,
      member_id: input.memberId || null,
      requester_name: input.requesterName || null,
      title: input.title,
      description: input.description,
      category: input.category,
      status: 'active',
      priority: input.priority,
      visibility: input.visibility,
      is_anonymous: input.isAnonymous,
      created_by: input.createdBy || null,
      updated_by: input.createdBy || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
