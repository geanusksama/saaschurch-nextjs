import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDiscipleship,
  createDiscipleshipMeeting,
  createDiscipleshipProgram,
  createDiscipleshipProgramLesson,
  createCounseling,
  createCounselingSession,
  createPastoralVisit,
  createPrayerRequest,
  getPastoralReportSummary,
  getCurrentChurchId,
  getPastoralDashboardSummary,
  getPastoralVisitById,
  listDiscipleshipProgramLessons,
  listPastoralTimeline,
  listCounselingSessions,
  listCounselings,
  listDiscipleshipPrograms,
  listDiscipleships,
  listMemberOptions,
  listPastoralVisits,
  listPrayerRequests,
  listUserOptions,
  prayForRequest,
  type PastoralVisitRow,
  type PrayerCategory,
} from './pastoralService';

function requiredChurchId() {
  const churchId = getCurrentChurchId();
  if (!churchId) throw new Error('Igreja ativa não encontrada.');
  return churchId;
}

function currentUserId() {
  try {
    const raw = localStorage.getItem('mrm_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id || null;
  } catch {
    return null;
  }
}

export function usePastoralDashboard() {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['pastoral-dashboard-summary', churchId],
    enabled: !!churchId,
    queryFn: () => getPastoralDashboardSummary(churchId!),
    staleTime: 20_000,
  });
}

export function usePastoralVisits(filters?: { search?: string; status?: 'all' | PastoralVisitRow['status'] }) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['pastoral-visits', churchId, filters?.search || '', filters?.status || 'all'],
    enabled: !!churchId,
    queryFn: () => listPastoralVisits({ churchId: churchId!, search: filters?.search, status: filters?.status }),
    staleTime: 20_000,
  });
}

export function usePastoralVisit(visitId?: string | null) {
  return useQuery({
    queryKey: ['pastoral-visit', visitId],
    enabled: !!visitId,
    queryFn: () => getPastoralVisitById(visitId!),
    staleTime: 20_000,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPastoralVisit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pastoral-visits'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-dashboard-summary'] });
    },
  });
}

export function useCounselings(filters?: { search?: string; status?: 'all' | 'active' | 'completed' | 'paused' | 'cancelled'; type?: string }) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['pastoral-counselings', churchId, filters?.search || '', filters?.status || 'all', filters?.type || 'all'],
    enabled: !!churchId,
    queryFn: () => listCounselings({
      churchId: churchId!,
      search: filters?.search,
      status: filters?.status,
      type: filters?.type,
    }),
    staleTime: 20_000,
  });
}

export function useCreateCounseling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCounseling,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pastoral-counselings'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-dashboard-summary'] });
    },
  });
}

export function useCounselingSessions(counselingId?: string | null) {
  return useQuery({
    queryKey: ['pastoral-counseling-sessions', counselingId],
    enabled: !!counselingId,
    queryFn: () => listCounselingSessions(counselingId!),
    staleTime: 20_000,
  });
}

export function useCreateCounselingSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCounselingSession,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['pastoral-counseling-sessions', variables.counselingId] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-counselings'] });
    },
  });
}

export function usePrayerRequests(filters?: { search?: string; category?: PrayerCategory | 'all'; answered?: boolean; urgent?: boolean }) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['prayer-requests', churchId, filters?.search || '', filters?.category || 'all', !!filters?.answered, !!filters?.urgent],
    enabled: !!churchId,
    queryFn: () => listPrayerRequests({
      churchId: churchId!,
      search: filters?.search,
      category: filters?.category,
      answered: filters?.answered,
      urgent: filters?.urgent,
    }),
    staleTime: 20_000,
  });
}

export function useCreatePrayerRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPrayerRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      void queryClient.invalidateQueries({ queryKey: ['prayer-wall-summary'] });
    },
  });
}

export function usePrayRequest() {
  const queryClient = useQueryClient();
  const churchId = getCurrentChurchId();
  const userId = currentUserId();

  return useMutation({
    mutationFn: (payload: { requestId: string; mode: 'prayed' | 'amen' }) => prayForRequest({
      churchId: churchId!,
      requestId: payload.requestId,
      userId,
      mode: payload.mode,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      void queryClient.invalidateQueries({ queryKey: ['prayer-wall-summary'] });
    },
  });
}

export function useDiscipleships(filters?: { search?: string; status?: 'all' | 'active' | 'completed' | 'paused' | 'cancelled' }) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['discipleships', churchId, filters?.search || '', filters?.status || 'all'],
    enabled: !!churchId,
    queryFn: () => listDiscipleships({ churchId: churchId!, search: filters?.search, status: filters?.status }),
    staleTime: 20_000,
  });
}

export function useDiscipleshipPrograms() {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['discipleship-programs', churchId],
    enabled: !!churchId,
    queryFn: () => listDiscipleshipPrograms(churchId!),
    staleTime: 20_000,
  });
}

export function useCreateDiscipleship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiscipleship,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discipleships'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-dashboard-summary'] });
    },
  });
}

export function useCreateDiscipleshipMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiscipleshipMeeting,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discipleships'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-timeline'] });
    },
  });
}

export function useCreateDiscipleshipProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiscipleshipProgram,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discipleship-programs'] });
    },
  });
}

export function useDiscipleshipProgramLessons(programId?: string | null) {
  return useQuery({
    queryKey: ['discipleship-program-lessons', programId],
    enabled: !!programId,
    queryFn: () => listDiscipleshipProgramLessons(programId!),
    staleTime: 20_000,
  });
}

export function useCreateDiscipleshipProgramLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiscipleshipProgramLesson,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['discipleship-program-lessons', variables.programId] });
      void queryClient.invalidateQueries({ queryKey: ['discipleship-programs'] });
    },
  });
}

export function usePastoralTimeline(filters?: { memberId?: string }) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['pastoral-timeline', churchId, filters?.memberId || 'all'],
    enabled: !!churchId,
    queryFn: () => listPastoralTimeline({ churchId: churchId!, memberId: filters?.memberId }),
    staleTime: 20_000,
  });
}

export function usePastoralReportSummary(input: { startDate: string; endDate: string }) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['pastoral-report-summary', churchId, input.startDate, input.endDate],
    enabled: !!churchId && !!input.startDate && !!input.endDate,
    queryFn: () => getPastoralReportSummary({ churchId: churchId!, startDate: input.startDate, endDate: input.endDate }),
    staleTime: 20_000,
  });
}

export function useMemberOptions(search?: string) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['member-options', churchId, search || ''],
    enabled: !!churchId,
    queryFn: () => listMemberOptions(churchId!, search),
    staleTime: 30_000,
  });
}

export function useUserOptions(search?: string) {
  const churchId = getCurrentChurchId();
  return useQuery({
    queryKey: ['user-options', churchId, search || ''],
    enabled: !!churchId,
    queryFn: () => listUserOptions(churchId!, search),
    staleTime: 30_000,
  });
}

export function buildVisitPayload(input: {
  memberId: string;
  responsibleId: string;
  title: string;
  visitType: PastoralVisitRow['visit_type'];
  date: string;
  time: string;
  reason: string;
  address?: string;
  notes?: string;
  durationMinutes?: number;
}) {
  const churchId = requiredChurchId();
  const userId = currentUserId();
  const scheduledAt = `${input.date}T${input.time || '09:00'}:00`;

  return {
    churchId,
    memberId: input.memberId,
    responsibleId: input.responsibleId,
    title: input.title,
    visitType: input.visitType,
    scheduledAt,
    reason: input.reason,
    address: input.address,
    notes: input.notes,
    durationMinutes: input.durationMinutes,
    createdBy: userId,
  };
}
