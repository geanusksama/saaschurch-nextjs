/**
 * PastoralAttendanceDetail — Painel lateral de detalhe do atendimento pastoral
 *
 * Módulo EXCLUSIVO do pastoral. NÃO compartilha dados com a Secretaria/CRM.
 */

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Heart,
  Phone,
  Mail,
  MessageCircle,
  Video,
  Clock,
  Flag,
  User,
  Calendar,
  Tag,
  ChevronRight,
  Plus,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  History,
  Paperclip,
  Loader2,
  Star,
  Edit2,
  Move,
  Trash2,
  Pencil,
  Download,
  Upload,
} from 'lucide-react';
import {
  type PastoralPipelineColumn,
  type PastoralAttendance,
  type AttendanceType,
  type Priority,
  type ParticipantRole,
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  ACTIVITY_TYPE_LABELS,
  PARTICIPANT_ROLE_LABELS,
  getCurrentChurchId,
  getPastoralAttendanceById,
  listPastoralActivities,
  listPastoralNotes,
  listPastoralTimeline,
  listPastoralParticipants,
  addPastoralParticipant,
  removePastoralParticipant,
  createPastoralActivity,
  createPastoralNote,
  completePastoralActivity,
  movePastoralAttendance,
  updatePastoralAttendance,
  deletePastoralNote,
  updatePastoralNote,
  deletePastoralActivity,
  updatePastoralActivity,
} from '../../lib/pastoralKanbanService';
import { supabase } from '../../lib/supabaseClient';

type TabId = 'notas' | 'atividades' | 'pessoas' | 'timeline' | 'arquivos';

// ─── Timeline event icon ─────────────────────────────────────────────────────

function TimelineEventIcon({ eventType }: { eventType: string }) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white';
  if (eventType === 'created')  return <div className={`${base} bg-green-500`}><Plus       className="w-3 h-3" /></div>;
  if (eventType === 'moved')    return <div className={`${base} bg-blue-500`}><Move        className="w-3 h-3" /></div>;
  if (eventType === 'note')     return <div className={`${base} bg-purple-500`}><FileText  className="w-3 h-3" /></div>;
  if (eventType === 'activity') return <div className={`${base} bg-orange-500`}><Activity className="w-3 h-3" /></div>;
  if (eventType === 'call')     return <div className={`${base} bg-sky-500`}><Phone        className="w-3 h-3" /></div>;
  return                               <div className={`${base} bg-slate-400`}><Clock      className="w-3 h-3" /></div>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PastoralAttendanceDetail({
  attendanceId,
  columns,
  onClose,
  onMoved,
}: {
  attendanceId: string;
  columns: PastoralPipelineColumn[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const churchId = getCurrentChurchId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('notas');
  const [noteText, setNoteText] = useState('');
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantRole, setParticipantRole] = useState<ParticipantRole>('atendido');
  // Note edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  // Activity edit state
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityForm, setEditingActivityForm] = useState({ type: '', title: '', description: '', scheduledDate: '', durationMinutes: '30', priority: 'normal' });
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activityForm, setActivityForm] = useState({
    type: 'ligacao',
    title: '',
    description: '',
    scheduledDate: '',
    durationMinutes: '30',
    priority: 'normal',
  });

  // Queries
  const { data: attendance, isLoading } = useQuery({
    queryKey: ['pastoral-attendance-detail', attendanceId],
    queryFn: () => getPastoralAttendanceById(attendanceId),
    staleTime: 5_000,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['pastoral-attendance-activities', attendanceId],
    queryFn: () => listPastoralActivities(attendanceId),
    staleTime: 5_000,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['pastoral-attendance-notes', attendanceId],
    queryFn: () => listPastoralNotes(attendanceId),
    staleTime: 5_000,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['pastoral-attendance-timeline', attendanceId],
    queryFn: () => listPastoralTimeline(attendanceId),
    staleTime: 5_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['pastoral-attendance-participants', attendanceId],
    queryFn: () => listPastoralParticipants(attendanceId),
    staleTime: 5_000,
  });

  const storagePath = `pastoral/attendances/${attendanceId}`;
  const { data: uploadedFiles = [], refetch: refetchFiles } = useQuery({
    queryKey: ['pastoral-attendance-files', attendanceId],
    queryFn: async () => {
      const { data } = await supabase.storage.from('dados').list(storagePath, { sortBy: { column: 'name', order: 'asc' } });
      return (data ?? []) as { name: string; metadata?: { size?: number } }[];
    },
    staleTime: 15_000,
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${storagePath}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('dados').upload(path, file);
      if (error) throw error;
      await refetchFiles();
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (fileName: string) => {
    await supabase.storage.from('dados').remove([`${storagePath}/${fileName}`]);
    await refetchFiles();
  };

  // Member search for participant form
  const { data: memberSearchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['pastoral-participant-member-search', churchId, participantSearch],
    enabled: !!churchId && participantSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('church_id', churchId)
        .ilike('full_name', `%${participantSearch}%`)
        .limit(8);
      return (data ?? []) as { id: string; full_name: string }[];
    },
    staleTime: 10_000,
  });

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: () =>
      createPastoralNote({
        attendanceId,
        churchId: churchId!,
        content: noteText.trim(),
      }),
    onSuccess: () => {
      setNoteText('');
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-notes', attendanceId] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-timeline', attendanceId] });
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: () =>
      createPastoralActivity({
        attendanceId,
        churchId: churchId!,
        activityType: activityForm.type,
        title: activityForm.title,
        description: activityForm.description || undefined,
        scheduledDate: activityForm.scheduledDate ? `${activityForm.scheduledDate}:00` : undefined,
        durationMinutes: Number(activityForm.durationMinutes) || undefined,
        priority: activityForm.priority,
      }),
    onSuccess: () => {
      setShowActivityForm(false);
      setActivityForm({ type: 'ligacao', title: '', description: '', scheduledDate: '', durationMinutes: '30', priority: 'normal' });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-activities', attendanceId] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-timeline', attendanceId] });
    },
  });

  const completeActivityMutation = useMutation({
    mutationFn: completePastoralActivity,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-activities', attendanceId] }),
  });

  const addParticipantMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ParticipantRole }) =>
      addPastoralParticipant({ attendanceId, churchId: churchId!, memberId, role }),
    onSuccess: () => {
      setParticipantSearch('');
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-participants', attendanceId] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: removePastoralParticipant,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-participants', attendanceId] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deletePastoralNote,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-notes', attendanceId] }),
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => updatePastoralNote(id, content),
    onSuccess: () => {
      setEditingNoteId(null);
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-notes', attendanceId] });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: deletePastoralActivity,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-activities', attendanceId] }),
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updatePastoralActivity>[1] }) => updatePastoralActivity(id, patch),
    onSuccess: () => {
      setEditingActivityId(null);
      void queryClient.invalidateQueries({ queryKey: ['pastoral-attendance-activities', attendanceId] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: (targetColumn: PastoralPipelineColumn) =>
      movePastoralAttendance({
        attendanceId,
        targetColumnId: targetColumn.id,
        targetColumnKey: targetColumn.column_key,
        targetColumnName: targetColumn.name,
        churchId: churchId!,
      }),
    onSuccess: () => {
      setShowMoveMenu(false);
      onMoved();
    },
  });

  if (isLoading || !attendance) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/30" onClick={onClose} />
        <div className="w-full max-w-xl bg-white shadow-2xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  const typeColor = ATTENDANCE_TYPE_COLORS[attendance.attendance_type] ?? '#6366f1';
  const personName = attendance.members?.full_name || attendance.visitor_name || attendance.title || 'Sem identificação';
  const currentColumn = columns.find((c) => c.id === attendance.column_id);
  const isOverdue = attendance.sla_date && new Date(attendance.sla_date) < new Date() && attendance.status !== 'done' && attendance.status !== 'cancelled';

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'notas',      label: 'Notas',      icon: <FileText   className="w-4 h-4" />, count: notes.length },
    { id: 'atividades', label: 'Atividades', icon: <Activity   className="w-4 h-4" />, count: activities.filter(a => !a.completed).length },
    { id: 'pessoas',    label: 'Pessoas',    icon: <User       className="w-4 h-4" />, count: participants.length },
    { id: 'timeline',   label: 'Timeline',   icon: <History    className="w-4 h-4" />, count: timeline.length },
    { id: 'arquivos',   label: 'Arquivos',   icon: <Paperclip  className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200">
          {/* Color stripe */}
          <div className="h-1.5" style={{ backgroundColor: typeColor }} />

          <div className="px-5 py-4">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                  style={{ backgroundColor: typeColor }}
                >
                  {personName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{personName}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: typeColor }}
                    >
                      {ATTENDANCE_TYPE_LABELS[attendance.attendance_type]}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${PRIORITY_COLORS[attendance.priority]}20`, color: PRIORITY_COLORS[attendance.priority] }}
                    >
                      {PRIORITY_LABELS[attendance.priority]}
                    </span>
                    {isOverdue && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Atrasado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
              <Heart className="w-3.5 h-3.5 text-green-500" />
              <span className="font-medium text-green-600">Pastoral</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{currentColumn?.name ?? '—'}</span>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {attendance.churches?.name && (
                <div className="flex items-center gap-2 text-slate-600 col-span-2">
                  <Heart className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-green-700">{attendance.churches.name}</span>
                </div>
              )}
              {attendance.users?.full_name && (
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{attendance.users.full_name}</span>
                </div>
              )}
              {attendance.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{attendance.phone}</span>
                </div>
              )}
              {attendance.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{attendance.email}</span>
                </div>
              )}
              {attendance.sla_date && (
                <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                  <Clock className="w-4 h-4" />
                  <span>SLA: {new Date(attendance.sla_date).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>Criado: {new Date(attendance.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              {attendance.phone && (
                <a href={`https://wa.me/${attendance.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors">
                  <MessageCircle className="w-4 h-4" />WhatsApp
                </a>
              )}
              {attendance.phone && (
                <a href={`tel:${attendance.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors">
                  <Phone className="w-4 h-4" />Ligar
                </a>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowMoveMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  <Move className="w-4 h-4" />Mover
                </button>
                {showMoveMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden min-w-[160px]">
                    {columns.map((col) => (
                      <button
                        key={col.id}
                        disabled={col.id === attendance.column_id}
                        onClick={() => moveMutation.mutate(col)}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                        {col.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowActivityForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-colors ml-auto"
              >
                <Plus className="w-4 h-4" />Nova Atividade
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-slate-100 px-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── NOTAS ── */}
          {activeTab === 'notas' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  placeholder="Digite uma nota sobre este atendimento..."
                  className="w-full px-4 py-3 text-sm resize-none border-0 focus:outline-none focus:ring-0"
                />
                <div className="flex items-center justify-end px-4 py-2.5 bg-slate-50 border-t border-slate-200 gap-2">
                  <button
                    onClick={() => noteText.trim() && addNoteMutation.mutate()}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {addNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className={`bg-white border rounded-xl p-4 ${note.is_pinned ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
                    {note.is_pinned && (
                      <div className="flex items-center gap-1 text-amber-600 text-xs font-semibold mb-2">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />Fixada
                      </div>
                    )}
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          rows={3}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateNoteMutation.mutate({ id: note.id, content: editingNoteText })}
                            disabled={!editingNoteText.trim() || updateNoteMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {updateNoteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                          </button>
                          <button onClick={() => setEditingNoteId(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleString('pt-BR')}</span>
                      {editingNoteId !== note.id && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.content); }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteNoteMutation.mutate(note.id)}
                            disabled={deleteNoteMutation.isPending}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">Nenhuma nota registrada.</p>
                )}
              </div>
            </div>
          )}

          {/* ── ATIVIDADES ── */}
          {activeTab === 'atividades' && (
            <div className="space-y-4">
              {showActivityForm && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                  <h4 className="font-semibold text-slate-800 text-sm">Nova Atividade</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo</label>
                      <select value={activityForm.type} onChange={(e) => setActivityForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2">
                        {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Prioridade</label>
                      <select value={activityForm.priority} onChange={(e) => setActivityForm(f => ({ ...f, priority: e.target.value }))}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2">
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Assunto *</label>
                      <input value={activityForm.title} onChange={(e) => setActivityForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Título da atividade" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Data e Hora</label>
                      <input type="datetime-local" value={activityForm.scheduledDate} onChange={(e) => setActivityForm(f => ({ ...f, scheduledDate: e.target.value }))}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Duração (min)</label>
                      <input type="number" value={activityForm.durationMinutes} onChange={(e) => setActivityForm(f => ({ ...f, durationMinutes: e.target.value }))}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Descrição</label>
                      <textarea value={activityForm.description} onChange={(e) => setActivityForm(f => ({ ...f, description: e.target.value }))}
                        rows={2} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addActivityMutation.mutate()} disabled={!activityForm.title.trim() || addActivityMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
                      {addActivityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar
                    </button>
                    <button onClick={() => setShowActivityForm(false)} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className={`bg-white border rounded-xl p-4 ${act.completed ? 'opacity-60 border-slate-100' : 'border-slate-200'}`}>
                    {editingActivityId === act.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo</label>
                            <select value={editingActivityForm.type} onChange={(e) => setEditingActivityForm(f => ({ ...f, type: e.target.value }))}
                              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5">
                              {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Prioridade</label>
                            <select value={editingActivityForm.priority} onChange={(e) => setEditingActivityForm(f => ({ ...f, priority: e.target.value }))}
                              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5">
                              <option value="normal">Normal</option>
                              <option value="high">Alta</option>
                              <option value="urgent">Urgente</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Assunto</label>
                            <input value={editingActivityForm.title} onChange={(e) => setEditingActivityForm(f => ({ ...f, title: e.target.value }))}
                              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Data e Hora</label>
                            <input type="datetime-local" value={editingActivityForm.scheduledDate} onChange={(e) => setEditingActivityForm(f => ({ ...f, scheduledDate: e.target.value }))}
                              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Duração (min)</label>
                            <input type="number" value={editingActivityForm.durationMinutes} onChange={(e) => setEditingActivityForm(f => ({ ...f, durationMinutes: e.target.value }))}
                              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Descrição</label>
                            <textarea value={editingActivityForm.description} onChange={(e) => setEditingActivityForm(f => ({ ...f, description: e.target.value }))}
                              rows={2} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 resize-none" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateActivityMutation.mutate({ id: act.id, patch: {
                              title: editingActivityForm.title,
                              description: editingActivityForm.description || undefined,
                              activity_type: editingActivityForm.type,
                              priority: editingActivityForm.priority,
                              scheduled_date: editingActivityForm.scheduledDate ? `${editingActivityForm.scheduledDate}:00` : null,
                              duration_minutes: Number(editingActivityForm.durationMinutes) || null,
                            }})}
                            disabled={!editingActivityForm.title.trim() || updateActivityMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {updateActivityMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                          </button>
                          <button onClick={() => setEditingActivityId(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => !act.completed && completeActivityMutation.mutate(act.id)}
                          disabled={act.completed}
                          className="mt-0.5 flex-shrink-0"
                        >
                          <CheckCircle2 className={`w-5 h-5 ${act.completed ? 'text-green-500 fill-green-100' : 'text-slate-300 hover:text-green-500 transition-colors'}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-500 uppercase">
                              {ACTIVITY_TYPE_LABELS[act.activity_type] ?? act.activity_type}
                            </span>
                            {act.priority === 'urgent' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          <p className={`text-sm font-semibold ${act.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{act.title}</p>
                          {act.description && <p className="text-sm text-slate-500 mt-0.5">{act.description}</p>}
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                            {act.scheduled_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(act.scheduled_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            )}
                            {act.duration_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />{act.duration_minutes} min
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          <button onClick={() => {
                            setEditingActivityId(act.id);
                            setEditingActivityForm({
                              type: act.activity_type,
                              title: act.title,
                              description: act.description ?? '',
                              scheduledDate: act.scheduled_date ? act.scheduled_date.slice(0, 16) : '',
                              durationMinutes: String(act.duration_minutes ?? 30),
                              priority: act.priority ?? 'normal',
                            });
                          }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteActivityMutation.mutate(act.id)}
                            disabled={deleteActivityMutation.isPending}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {activities.length === 0 && !showActivityForm && (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-400 mb-3">Nenhuma atividade cadastrada.</p>
                    <button onClick={() => setShowActivityForm(true)}
                      className="flex items-center gap-1.5 mx-auto px-4 py-2 bg-orange-50 text-orange-700 text-sm font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                      <Plus className="w-4 h-4" />Criar primeira atividade
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TIMELINE ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-0.5">
              {timeline.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <TimelineEventIcon eventType={entry.event_type} />
                    {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <p className="text-sm text-slate-700">{entry.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum evento na timeline.</p>
              )}
            </div>
          )}

          {/* ── PESSOAS ── */}
          {activeTab === 'pessoas' && (
            <div className="space-y-4">
              {/* Badges of current participants */}
              {participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => {
                    const name = p.members?.full_name || p.users?.full_name || '—';
                    return (
                      <span key={p.id}
                        className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-sm font-medium"
                      >
                        <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">
                          {name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate max-w-[160px]">{name}</span>
                        <span className="text-xs text-green-600 opacity-70">· {PARTICIPANT_ROLE_LABELS[p.role] ?? p.role}</span>
                        <button
                          onClick={() => removeParticipantMutation.mutate(p.id)}
                          className="ml-0.5 hover:text-red-500 text-green-500 transition-colors"
                          title="Remover"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Add participant form — always visible */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-semibold text-slate-800 text-sm">Adicionar Pessoa</h4>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Papel</label>
                  <select value={participantRole} onChange={(e) => setParticipantRole(e.target.value as ParticipantRole)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white">
                    {(Object.entries(PARTICIPANT_ROLE_LABELS) as [ParticipantRole, string][]).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Buscar membro</label>
                  <input
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Nome do membro..."
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                  />
                  {participantSearch.length >= 2 && (
                    <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      {searchLoading ? (
                        <div className="flex items-center justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                      ) : memberSearchResults.length > 0 ? (
                        memberSearchResults
                          .filter(m => !participants.some(p => p.member_id === m.id))
                          .map((m) => (
                          <button key={m.id}
                            onClick={() => addParticipantMutation.mutate({ memberId: m.id, role: participantRole })}
                            disabled={addParticipantMutation.isPending}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-green-50 hover:text-green-800 text-left border-b border-slate-100 last:border-0 transition-colors">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{m.full_name}</span>
                            <span className="ml-auto text-xs text-green-600 opacity-0 group-hover:opacity-100">+ Adicionar</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2.5 text-sm text-slate-400">Nenhum membro encontrado</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ARQUIVOS ── */}
          {activeTab === 'arquivos' && (
            <div className="space-y-4">
              {/* Upload zone */}
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-green-300 hover:bg-green-50/30 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) void handleFileUpload(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                    <p className="text-sm text-slate-500">Enviando arquivo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">Clique para selecionar ou arraste um arquivo</p>
                    <p className="text-xs text-slate-400">PDF, imagens, documentos...</p>
                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Anexar Arquivo
                    </button>
                  </div>
                )}
              </div>

              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file) => {
                    const { data: { publicUrl } } = supabase.storage.from('dados').getPublicUrl(`${storagePath}/${file.name}`);
                    const sizeKb = file.metadata?.size ? Math.round(file.metadata.size / 1024) : null;
                    return (
                      <div key={file.name} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                        <Paperclip className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{file.name.replace(/^\d+_/, '')}</p>
                          {sizeKb && <p className="text-xs text-slate-400">{sizeKb} KB</p>}
                        </div>
                        <a href={publicUrl} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => void handleFileDelete(file.name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {uploadedFiles.length === 0 && !uploading && (
                <p className="text-sm text-slate-400 text-center">Nenhum arquivo anexado.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
