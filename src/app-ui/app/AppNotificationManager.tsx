'use client';
import React, { useState, useMemo } from 'react';
import {
  Bell, Plus, Send, Pencil, Trash2, Search, X, Clock,
  CheckCircle, Archive, Users, Building2, MapPin, Globe,
  Image, Video, Music, RefreshCw, Eye, CalendarClock, Check,
  AlertTriangle, ChevronDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type TargetType  = 'all' | 'campo' | 'regional' | 'church';
type MediaType   = 'image' | 'video' | 'audio';
type NotifStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled';

interface PushNotif {
  id: string;
  title: string;
  body: string;
  media_url: string | null;
  media_type: MediaType | null;
  action_url: string | null;
  target_type: TargetType;
  target_ids: string[];
  status: NotifStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  campo_id: string | null;
  recipient_count: number;
  created_at: string;
}

interface FormState {
  title: string;
  body: string;
  media_url: string | null;
  media_type: MediaType | null;
  action_url: string | null;
  target_type: TargetType;
  target_ids: string[];
  status: NotifStatus;
  scheduled_at: string | null;
}

interface Regional { id: string; name: string; }
interface Church   { id: string; name: string; regional_id: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<NotifStatus, { label: string; icon: React.ElementType; cls: string }> = {
  draft:     { label: 'Rascunho',  icon: Clock,         cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  scheduled: { label: 'Agendado',  icon: CalendarClock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  sent:      { label: 'Enviado',   icon: CheckCircle,   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'Cancelado', icon: Archive,       cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

const MEDIA_CFG: Record<MediaType, { label: string; icon: React.ElementType }> = {
  image: { label: 'Imagem', icon: Image },
  video: { label: 'Vídeo',  icon: Video },
  audio: { label: 'Áudio',  icon: Music },
};

const EMPTY_FORM: FormState = {
  title: '', body: '', media_url: null, media_type: null, action_url: null,
  target_type: 'campo', target_ids: [], status: 'draft', scheduled_at: null,
};

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── MultiSelectList (padrão do sistema) ─────────────────────────────────────

function MultiSelectList({
  items, selected, onToggle, onSelectAll, onClearAll, emptyMsg, label,
}: {
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  emptyMsg: string;
  label: string;
}) {
  const [search, setSearch] = useState('');
  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  if (items.length === 0) return (
    <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center px-3">{emptyMsg}</p>
  );

  return (
    <div>
      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder={`Pesquisar ${label.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>
      {/* Marcar / Desmarcar todos */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
        <button type="button" onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium">
          Marcar todos
        </button>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClearAll(); }}
          className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
          Desmarcar todos
        </button>
        {selected.length > 0 && (
          <span className="ml-auto text-xs font-medium text-purple-600 dark:text-purple-400">
            {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* List */}
      <div className="max-h-52 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Nenhum resultado</p>
        ) : filtered.map(item => {
          const checked = selected.includes(item.id);
          return (
            <div
              key={item.id}
              onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                checked ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
              }`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                checked ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700'
              }`}>
                {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className={`text-sm flex-1 ${checked ? 'text-purple-700 dark:text-purple-300 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                {item.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DropdownSelect ───────────────────────────────────────────────────────────

function DropdownSelect({
  label, singularLabel, items, selected, onToggle, onSelectAll, onClearAll, emptyMsg, open, onOpen, onClose,
}: {
  label: string;
  singularLabel?: string;
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  emptyMsg: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const singular = singularLabel ?? label;
  const btnLabel = selected.length > 0
    ? `${selected.length} ${selected.length === 1 ? singular : label} selecionada${selected.length === 1 ? '' : 's'}`
    : `Selecionar ${label}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); open ? onClose() : onOpen(); }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
          open
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
            : selected.length > 0
              ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300'
              : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      >
        <span className="font-medium truncate">{btnLabel}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Transparent overlay to capture outside clicks */}
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); onClose(); }} />
          {/* Dropdown panel */}
          <div
            className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <MultiSelectList
              label={label}
              items={items}
              selected={selected}
              onToggle={onToggle}
              onSelectAll={onSelectAll}
              onClearAll={onClearAll}
              emptyMsg={emptyMsg}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppNotificationManager() {
  const qc   = useQueryClient();
  const user = getStoredUser();
  const campoId: string | undefined = user.campoId;
  const userRole: string = user.role ?? user.rol ?? '';
  const isMasterOrAdmin = ['master', 'admin', 'super_admin'].includes(userRole);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState<NotifStatus | 'all'>('all');
  const [editing, setEditing]         = useState<PushNotif | null>(null);
  const [isNew, setIsNew]             = useState(false);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [preview, setPreview]         = useState<PushNotif | null>(null);
  const [confirmSend, setConfirmSend] = useState<PushNotif | null>(null);
  // Dropdown open state
  const [openDrop, setOpenDrop] = useState<'regional' | 'church' | 'churchFilter' | null>(null);
  // Regional filter for the church target type (separate from target_ids)
  const [churchFilter, setChurchFilter] = useState<string[]>([]);

  const showForm = isNew || editing !== null;

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: notifs = [], isLoading, refetch } = useQuery<PushNotif[]>({
    queryKey: ['app_push_notifications', campoId, statusFilter],
    queryFn: async () => {
      let q = supabase.from('app_push_notifications').select('*').order('created_at', { ascending: false });
      if (campoId)                q = q.eq('campo_id', campoId);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PushNotif[];
    },
  });

  const { data: regionais = [] } = useQuery<Regional[]>({
    queryKey: ['regionais-for-notif', campoId],
    queryFn: async () => {
      let q = supabase.from('regionais').select('id, name').order('name');
      if (campoId) q = q.eq('campo_id', campoId);
      const { data } = await q.limit(200);
      return (data ?? []) as Regional[];
    },
    enabled: showForm && (form.target_type === 'regional' || form.target_type === 'church'),
    staleTime: 60_000,
  });

  // For churches: filter by selected regionals (churchFilter), or all if none selected
  const regionalIdsForChurches = useMemo(() => {
    if (form.target_type !== 'church') return [];
    if (regionais.length === 0) return [];
    return churchFilter.length > 0 ? churchFilter : regionais.map(r => r.id);
  }, [form.target_type, churchFilter, regionais]);

  const { data: churches = [] } = useQuery<Church[]>({
    queryKey: ['churches-for-notif', regionalIdsForChurches],
    queryFn: async () => {
      let q = supabase.from('churches').select('id, name, regional_id').order('name');
      if (regionalIdsForChurches.length > 0) q = q.in('regional_id', regionalIdsForChurches);
      const { data } = await q.limit(500);
      return (data ?? []) as Church[];
    },
    enabled: showForm && form.target_type === 'church' && regionalIdsForChurches.length > 0,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      if (!campoId) throw new Error('Campo não identificado. Faça login novamente.');
      const now  = new Date().toISOString();
      const resolvedIds = payload.target_type === 'campo'
        ? [campoId]
        : payload.target_type === 'all'
          ? []
          : payload.target_ids;
      const base = {
        title: payload.title, body: payload.body,
        media_url: payload.media_url, media_type: payload.media_type,
        action_url: payload.action_url,
        target_type: payload.target_type,
        target_ids: resolvedIds,
        status: payload.status, scheduled_at: payload.scheduled_at,
        campo_id: campoId,
      };
      if (payload.id) {
        const { error } = await supabase.from('app_push_notifications')
          .update({ ...base, updated_at: now }).eq('id', payload.id).eq('campo_id', campoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('app_push_notifications')
          .insert({ ...base, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app_push_notifications'] }); closeForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!campoId) throw new Error('Campo não identificado.');
      const { error } = await supabase.from('app_push_notifications').delete()
        .eq('id', id).eq('campo_id', campoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_push_notifications'] }),
  });

  const sendMut = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase.from('app_push_notifications')
        .update({ status: 'sent', sent_at: now, updated_at: now })
        .eq('id', id).eq('campo_id', campoId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app_push_notifications'] }); setConfirmSend(null); },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openNew() {
    setForm({ ...EMPTY_FORM, target_type: isMasterOrAdmin ? 'all' : 'campo' });
    setEditing(null);
    setIsNew(true);
    setOpenDrop(null);
    setChurchFilter([]);
  }

  function openEdit(n: PushNotif) {
    setForm({
      title: n.title, body: n.body, media_url: n.media_url, media_type: n.media_type,
      action_url: n.action_url, target_type: n.target_type,
      target_ids: n.target_ids ?? [], status: n.status, scheduled_at: n.scheduled_at,
    });
    setEditing(n);
    setIsNew(false);
    setOpenDrop(null);
    setChurchFilter([]);
  }

  function closeForm() {
    setIsNew(false);
    setEditing(null);
    setOpenDrop(null);
    setChurchFilter([]);
  }

  function handleSave() {
    saveMut.mutate({ ...form, ...(editing ? { id: editing.id } : {}) });
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function toggleTarget(id: string) {
    setForm(p => ({
      ...p,
      target_ids: p.target_ids.includes(id)
        ? p.target_ids.filter(x => x !== id)
        : [...p.target_ids, id],
    }));
  }

  function changeTargetType(tt: TargetType) {
    setForm(p => ({ ...p, target_type: tt, target_ids: [] }));
    setOpenDrop(null);
  }

  function toggleChurchFilter(id: string) {
    setChurchFilter(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    // Clear church selections when changing filter
    setField('target_ids', []);
  }

  const filtered = notifs.filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.body.toLowerCase().includes(search.toLowerCase())
  );

  const availableTargets: TargetType[] = isMasterOrAdmin
    ? ['all', 'campo', 'regional', 'church']
    : ['campo', 'regional', 'church'];

  const TARGET_CFG: Record<TargetType, { label: string; icon: React.ElementType; desc: string }> = {
    all:      { label: 'Todos',    icon: Globe,     desc: 'Todos os campos' },
    campo:    { label: 'Meu campo', icon: Users,    desc: 'Todos do seu campo' },
    regional: { label: 'Regional', icon: MapPin,    desc: 'Selecionar regionais' },
    church:   { label: 'Igreja',   icon: Building2, desc: 'Selecionar igrejas' },
  };

  const targetSummary = useMemo(() => {
    if (form.target_type === 'all')   return 'Todos os campos';
    if (form.target_type === 'campo') return 'Seu campo (automático)';
    if (form.target_type === 'regional') {
      if (form.target_ids.length === 0) return 'Nenhuma regional selecionada';
      return form.target_ids.map(id => regionais.find(r => r.id === id)?.name ?? id).join(', ');
    }
    if (form.target_type === 'church') {
      if (form.target_ids.length === 0) return 'Nenhuma igreja selecionada';
      return `${form.target_ids.length} ${form.target_ids.length === 1 ? 'igreja' : 'igrejas'} selecionada${form.target_ids.length === 1 ? '' : 's'}`;
    }
    return '';
  }, [form.target_type, form.target_ids, regionais]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-500" />
              Notificações do App
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Envie mensagens para usuários do app
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Nova notificação
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar título..."
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-52 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          {(['all', 'draft', 'scheduled', 'sent', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}>
              {s === 'all' ? 'Todos' : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
            <Bell className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma notificação encontrada</p>
            <p className="text-xs mt-1">Crie a primeira notificação para seu campo</p>
          </div>
        )}
        {filtered.map(n => {
          const S = STATUS_CFG[n.status];
          const StatusIcon = S.icon;
          const T = TARGET_CFG[n.target_type];
          const TargetIcon = T.icon;
          const isSent = n.status === 'sent';
          return (
            <div key={n.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex gap-4 hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
              <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700">
                {n.media_url && n.media_type === 'image'
                  ? <img src={n.media_url} alt="" className="w-full h-full object-cover" />
                  : n.media_type === 'video' ? <Video className="w-6 h-6 text-slate-400" />
                  : n.media_type === 'audio' ? <Music className="w-6 h-6 text-slate-400" />
                  : <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm flex-1 truncate">{n.title}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${S.cls}`}>
                    <StatusIcon className="w-3 h-3" /> {S.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{n.body}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1"><TargetIcon className="w-3 h-3" /> {T.label}
                    {n.target_ids?.length > 0 && <span className="ml-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 rounded-full">{n.target_ids.length}</span>}
                  </span>
                  {n.sent_at
                    ? <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {fmtDate(n.sent_at)}</span>
                    : <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(n.created_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setPreview(n)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors" title="Pré-visualizar">
                  <Eye className="w-4 h-4" />
                </button>
                {!isSent && (
                  <>
                    <button onClick={() => openEdit(n)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmSend(n)}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-colors" title="Enviar agora">
                      <Send className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={() => { if (confirm('Excluir esta notificação?')) deleteMut.mutate(n.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Form Drawer ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={closeForm} />
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 h-full overflow-y-auto shadow-2xl flex flex-col rounded-l-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isNew ? 'Nova notificação' : 'Editar notificação'}
              </h2>
              <button onClick={closeForm} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-5">

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Título *</label>
                <input value={form.title} onChange={e => setField('title', e.target.value)}
                  placeholder="Ex: Culto especial de aniversário"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              {/* Mensagem */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mensagem *</label>
                <textarea value={form.body} onChange={e => setField('body', e.target.value)} rows={4}
                  placeholder="Texto que o usuário verá ao abrir a notificação..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
              </div>

              {/* Mídia */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mídia (opcional)</label>
                <div className="flex gap-2 mb-2">
                  {(['image', 'video', 'audio'] as MediaType[]).map(mt => {
                    const cfg = MEDIA_CFG[mt];
                    const Icon = cfg.icon;
                    const sel = form.media_type === mt;
                    return (
                      <button key={mt} type="button" onClick={() => setField('media_type', sel ? null : mt)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}>
                        <Icon className="w-3.5 h-3.5" /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {form.media_type && (
                  <input value={form.media_url ?? ''} onChange={e => setField('media_url', e.target.value || null)}
                    placeholder={
                      form.media_type === 'image' ? 'URL da imagem (https://...)' :
                      form.media_type === 'video' ? 'URL do vídeo (YouTube, direto...)' :
                      'URL do áudio (MP3...)'
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                )}
              </div>

              {/* Público-alvo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Público-alvo</label>

                {/* Target type selector */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {availableTargets.map(tt => {
                    const cfg = TARGET_CFG[tt];
                    const Icon = cfg.icon;
                    const sel = form.target_type === tt;
                    return (
                      <button key={tt} type="button" onClick={() => changeTargetType(tt)}
                        className={`flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl border transition-colors text-left ${
                          sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">{cfg.label}</p>
                          <p className="text-[10px] opacity-70">{cfg.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Campo: auto-fill info */}
                {form.target_type === 'campo' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      Enviado para todos os membros do seu campo automaticamente.
                    </p>
                  </div>
                )}

                {/* All: info for admin/master */}
                {form.target_type === 'all' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <Globe className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Enviado para TODOS os usuários do app em todos os campos.
                    </p>
                  </div>
                )}

                {/* Regional: dropdown multi-select */}
                {form.target_type === 'regional' && (
                  <DropdownSelect
                    label="regionais"
                    singularLabel="regional"
                    items={regionais}
                    selected={form.target_ids}
                    onToggle={toggleTarget}
                    onSelectAll={() => setField('target_ids', regionais.map(r => r.id))}
                    onClearAll={() => setField('target_ids', [])}
                    emptyMsg="Nenhuma regional encontrada para este campo"
                    open={openDrop === 'regional'}
                    onOpen={() => setOpenDrop('regional')}
                    onClose={() => setOpenDrop(null)}
                  />
                )}

                {/* Church: filter by regional then select churches */}
                {form.target_type === 'church' && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                        Filtrar por regional <span className="font-normal opacity-70">(opcional)</span>
                      </p>
                      <DropdownSelect
                        label="regionais"
                        singularLabel="regional"
                        items={regionais}
                        selected={churchFilter}
                        onToggle={toggleChurchFilter}
                        onSelectAll={() => { setChurchFilter(regionais.map(r => r.id)); setField('target_ids', []); }}
                        onClearAll={() => { setChurchFilter([]); setField('target_ids', []); }}
                        emptyMsg="Nenhuma regional encontrada"
                        open={openDrop === 'churchFilter'}
                        onOpen={() => setOpenDrop('churchFilter')}
                        onClose={() => setOpenDrop(null)}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                        Selecionar igrejas
                      </p>
                      <DropdownSelect
                        label="igrejas"
                        singularLabel="igreja"
                        items={churches}
                        selected={form.target_ids}
                        onToggle={toggleTarget}
                        onSelectAll={() => setField('target_ids', churches.map(c => c.id))}
                        onClearAll={() => setField('target_ids', [])}
                        emptyMsg={regionalIdsForChurches.length === 0
                          ? 'Aguardando regionais carregarem...'
                          : 'Nenhuma igreja encontrada'}
                        open={openDrop === 'church'}
                        onOpen={() => setOpenDrop('church')}
                        onClose={() => setOpenDrop(null)}
                      />
                    </div>
                  </div>
                )}

                {/* Summary */}
                {targetSummary && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 pl-1">
                    → {targetSummary}
                  </p>
                )}
              </div>

              {/* Link de ação */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Link de ação (opcional)</label>
                <input value={form.action_url ?? ''} onChange={e => setField('action_url', e.target.value || null)}
                  placeholder="URL que abre ao tocar na notificação"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {(['draft', 'scheduled', 'cancelled'] as NotifStatus[]).map(s => {
                    const cfg = STATUS_CFG[s];
                    const Icon = cfg.icon;
                    const sel = form.status === s;
                    return (
                      <button key={s} type="button" onClick={() => setField('status', s)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}>
                        <Icon className="w-3.5 h-3.5" /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.status === 'scheduled' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Data/hora de envio</label>
                  <input type="datetime-local" value={form.scheduled_at?.slice(0, 16) ?? ''}
                    onChange={e => setField('scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              )}

              {saveMut.error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {(saveMut.error as Error).message}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-2 justify-end bg-slate-50 dark:bg-slate-800/80 sticky bottom-0">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancelar</button>
              <button onClick={handleSave}
                disabled={saveMut.isPending || !form.title.trim() || !form.body.trim()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2">
                {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPreview(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 dark:bg-slate-950 px-4 py-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-white/60" />
              <span className="text-white/60 text-xs">Notificação do App</span>
              <button onClick={() => setPreview(null)} className="ml-auto"><X className="w-4 h-4 text-white/60" /></button>
            </div>
            {preview.media_url && preview.media_type === 'image' && (
              <img src={preview.media_url} alt="" className="w-full max-h-56 object-cover" />
            )}
            {preview.media_url && preview.media_type === 'video' && (
              <div className="w-full aspect-video bg-black flex items-center justify-center gap-2">
                <Video className="w-8 h-8 text-white/40" />
                <span className="text-white/60 text-sm">Vídeo</span>
              </div>
            )}
            {preview.media_url && preview.media_type === 'audio' && (
              <div className="w-full py-6 bg-slate-900 flex items-center justify-center gap-3">
                <Music className="w-8 h-8 text-purple-400" />
                <span className="text-white/60 text-sm">Áudio disponível</span>
              </div>
            )}
            <div className="p-5">
              <p className="font-bold text-slate-900 dark:text-white text-base mb-2">{preview.title}</p>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{preview.body}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full ${STATUS_CFG[preview.status].cls}`}>{STATUS_CFG[preview.status].label}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  {React.createElement(TARGET_CFG[preview.target_type].icon, { className: 'w-3 h-3' })}
                  {TARGET_CFG[preview.target_type].label}
                  {preview.target_ids?.length > 0 && ` (${preview.target_ids.length})`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Send Modal ── */}
      {confirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setConfirmSend(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Send className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Enviar notificação?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              <strong className="text-slate-700 dark:text-slate-200">{confirmSend.title}</strong>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Público: <strong>{TARGET_CFG[confirmSend.target_type].label}</strong>
              {confirmSend.target_ids?.length > 0 && ` · ${confirmSend.target_ids.length} ${confirmSend.target_type === 'church' ? 'igrejas' : 'regionais'}`}.
              {' '}Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSend(null)} className="flex-1 px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={() => sendMut.mutate(confirmSend.id)} disabled={sendMut.isPending}
                className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {sendMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
