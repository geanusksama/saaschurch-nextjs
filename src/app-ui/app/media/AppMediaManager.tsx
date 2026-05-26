'use client';
/**
 * AppMediaManager — CRUD de conteúdo de mídia para o app Flutter
 * Gerencia a tabela app_media_items do Supabase.
 * Mesma tabela lida pelo PregacoesScreen no Flutter.
 */
import { useState } from 'react';
import {
  Play, Plus, Pencil, Trash2, Search, X, Eye, EyeOff,
  Radio, Mic2, Zap, Video, Podcast, Film, ExternalLink,
  Star, MoreVertical, Upload, Link, ChevronDown, RefreshCw,
  CheckCircle, Clock, AlertCircle, Archive,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaKind = 'live' | 'sermon' | 'short' | 'podcast' | 'video' | 'clip';
type PublishStatus = 'draft' | 'scheduled' | 'published' | 'archived';
type SourcePlatform = 'supabase' | 'youtube' | 'vimeo' | 'spotify' | 'external';

interface MediaItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  kind: MediaKind;
  publish_status: PublishStatus;
  thumbnail_url: string | null;
  watch_url: string | null;
  embed_url: string | null;
  duration_seconds: number;
  is_live_now: boolean;
  is_featured: boolean;
  view_count: number;
  badge_label: string | null;
  action_label: string | null;
  accent_hex: string | null;
  source_platform: SourcePlatform;
  published_at: string | null;
  campo_id: string | null;
  headquarters_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type MediaFormData = Omit<MediaItem, 'id' | 'view_count' | 'created_at' | 'updated_at'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_OPTIONS: { value: MediaKind; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'live',    label: 'Ao Vivo',   icon: Radio,   color: '#E53935' },
  { value: 'sermon',  label: 'Pregação',  icon: Mic2,    color: '#7C3AED' },
  { value: 'short',   label: 'Short',     icon: Zap,     color: '#F59E0B' },
  { value: 'podcast', label: 'Podcast',   icon: Podcast, color: '#0891B2' },
  { value: 'video',   label: 'Vídeo',     icon: Video,   color: '#2563EB' },
  { value: 'clip',    label: 'Clipe',     icon: Film,    color: '#059669' },
];

const STATUS_OPTIONS: { value: PublishStatus; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'published', label: 'Publicado',  icon: CheckCircle,  color: '#22C55E' },
  { value: 'draft',     label: 'Rascunho',   icon: Clock,        color: '#94A3B8' },
  { value: 'scheduled', label: 'Agendado',   icon: AlertCircle,  color: '#F59E0B' },
  { value: 'archived',  label: 'Arquivado',  icon: Archive,      color: '#6B7280' },
];

const PLATFORM_OPTIONS: { value: SourcePlatform; label: string }[] = [
  { value: 'youtube',   label: 'YouTube'   },
  { value: 'vimeo',     label: 'Vimeo'     },
  { value: 'spotify',   label: 'Spotify'   },
  { value: 'supabase',  label: 'Upload direto' },
  { value: 'external',  label: 'Link externo' },
];

const EMPTY_FORM: MediaFormData = {
  title: '',
  subtitle: '',
  description: '',
  kind: 'sermon',
  publish_status: 'draft',
  thumbnail_url: null,
  watch_url: null,
  embed_url: null,
  duration_seconds: 0,
  is_live_now: false,
  is_featured: false,
  badge_label: null,
  action_label: null,
  accent_hex: null,
  source_platform: 'youtube',
  published_at: null,
  campo_id: null,
  headquarters_id: null,
  active: true,
};

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) { const h = Math.floor(m / 60); const rm = m % 60; return `${h}:${String(rm).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)} mi`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(n >= 10_000 ? 0 : 1)} mil`;
  return String(n);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AppMediaManager() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const campoId: string | undefined = user.campoId;

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<MediaKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PublishStatus | 'all'>('all');
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<MediaFormData>(EMPTY_FORM);

  // ── Query — filtrado pelo campo do usuário logado ──
  const { data: items = [], isLoading, refetch } = useQuery<MediaItem[]>({
    queryKey: ['app_media_items', campoId, kindFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('app_media_items')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false });
      if (campoId) q = q.eq('campo_id', campoId);
      if (kindFilter !== 'all') q = q.eq('kind', kindFilter);
      if (statusFilter !== 'all') q = q.eq('publish_status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as MediaItem[]) ?? [];
    },
  });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async (payload: MediaFormData & { id?: string }) => {
      if (!campoId) throw new Error('Campo não identificado. Faça login novamente.');
      const now = new Date().toISOString();
      if (payload.id) {
        const { error } = await supabase
          .from('app_media_items')
          .update({ ...payload, updated_by: user.id, updated_at: now })
          .eq('id', payload.id)
          .eq('campo_id', campoId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_media_items')
          .insert({ ...payload, campo_id: campoId, created_by: user.id, view_count: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app_media_items'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!campoId) throw new Error('Campo não identificado.');
      const { error } = await supabase
        .from('app_media_items').delete()
        .eq('id', id)
        .eq('campo_id', campoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_media_items'] }),
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PublishStatus }) => {
      const now = new Date().toISOString();
      let q = supabase
        .from('app_media_items')
        .update({
          publish_status: status,
          published_at: status === 'published' ? now : null,
          updated_at: now,
        })
        .eq('id', id);
      if (campoId) q = q.eq('campo_id', campoId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_media_items'] }),
  });

  // ── Handlers ──
  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setIsNew(true);
  }

  function openEdit(item: MediaItem) {
    setForm({
      title: item.title, subtitle: item.subtitle, description: item.description,
      kind: item.kind, publish_status: item.publish_status,
      thumbnail_url: item.thumbnail_url, watch_url: item.watch_url, embed_url: item.embed_url,
      duration_seconds: item.duration_seconds, is_live_now: item.is_live_now, is_featured: item.is_featured,
      badge_label: item.badge_label, action_label: item.action_label, accent_hex: item.accent_hex,
      source_platform: item.source_platform, published_at: item.published_at,
      campo_id: item.campo_id, headquarters_id: item.headquarters_id, active: item.active,
    });
    setEditing(item);
    setIsNew(false);
  }

  function closeForm() { setEditing(null); setIsNew(false); }

  function saveForm() {
    saveMutation.mutate(editing ? { ...form, id: editing.id } : form);
  }

  const filtered = items.filter(item =>
    !search || item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.subtitle?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ──
  const showForm = isNew || editing !== null;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-purple-500" />
              Pregações e Mídia
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie o conteúdo publicado no app Flutter — tabela app_media_items
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="p-2 rounded-lg border dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo conteúdo
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar título..."
              className="pl-9 pr-3 py-2 text-sm rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-52 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Kind filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setKindFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${kindFilter === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Todos
            </button>
            {KIND_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setKindFilter(opt.value)}
                  style={kindFilter === opt.value ? { backgroundColor: opt.color, color: '#fff' } : {}}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${kindFilter === opt.value ? '' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Status select */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as PublishStatus | 'all')}
              className="pl-3 pr-8 py-1.5 text-xs rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos os status</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Video className="w-12 h-12 mb-3 opacity-40" />
            <p className="font-medium">Nenhum conteúdo encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo conteúdo" para começar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <MediaRow
                key={item.id}
                item={item}
                onEdit={() => openEdit(item)}
                onDelete={() => { if (confirm(`Excluir "${item.title}"?`)) deleteMutation.mutate(item.id); }}
                onTogglePublish={() => togglePublishMutation.mutate({
                  id: item.id,
                  status: item.publish_status === 'published' ? 'draft' : 'published',
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={closeForm} />
          <div className="w-full max-w-xl bg-white dark:bg-slate-800 h-full overflow-y-auto shadow-2xl flex flex-col rounded-l-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isNew ? 'Novo conteúdo' : 'Editar conteúdo'}
              </h2>
              <button onClick={closeForm} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-5">
              {/* Kind */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de conteúdo</label>
                <div className="flex gap-2 flex-wrap">
                  {KIND_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const sel = form.kind === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, kind: opt.value }))}
                        style={sel ? { borderColor: opt.color, backgroundColor: opt.color + '20', color: opt.color } : {}}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${sel ? '' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Culto da Família | O Deus que restaura casas"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subtítulo / Pregador</label>
                <input
                  value={form.subtitle}
                  onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Ex: Pr. Manoel Ferreira Netto"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Breve descrição do conteúdo..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Platform + Watch URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Plataforma de origem</label>
                <select
                  value={form.source_platform}
                  onChange={e => setForm(f => ({ ...f, source_platform: e.target.value as SourcePlatform }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                >
                  {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  value={form.watch_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, watch_url: e.target.value || null }))}
                  placeholder="URL para assistir (YouTube, Vimeo, etc.)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Embed URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  URL de embed <span className="text-slate-400 font-normal">(iframe)</span>
                </label>
                <input
                  value={form.embed_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, embed_url: e.target.value || null }))}
                  placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Thumbnail */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">URL da thumbnail</label>
                <input
                  value={form.thumbnail_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value || null }))}
                  placeholder="https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Duração (segundos)</label>
                <input
                  type="number"
                  value={form.duration_seconds}
                  onChange={e => setForm(f => ({ ...f, duration_seconds: Number(e.target.value) }))}
                  placeholder="Ex: 5118 (= 1h25m18s)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {form.duration_seconds > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{formatDuration(form.duration_seconds)}</p>
                )}
              </div>

              {/* Accent color */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cor de destaque</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accent_hex ?? '#7C3AED'}
                    onChange={e => setForm(f => ({ ...f, accent_hex: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border dark:border-slate-600"
                  />
                  <input
                    value={form.accent_hex ?? ''}
                    onChange={e => setForm(f => ({ ...f, accent_hex: e.target.value || null }))}
                    placeholder="#7C3AED"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Badge / Action labels */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Badge label</label>
                  <input
                    value={form.badge_label ?? ''}
                    onChange={e => setForm(f => ({ ...f, badge_label: e.target.value || null }))}
                    placeholder="STAFF PICK"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Action label</label>
                  <input
                    value={form.action_label ?? ''}
                    onChange={e => setForm(f => ({ ...f, action_label: e.target.value || null }))}
                    placeholder="Assistir"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3">
                {[
                  { key: 'is_featured', label: 'Em destaque (banner no topo do app)' },
                  { key: 'is_live_now', label: 'Ao vivo agora' },
                  { key: 'active',      label: 'Ativo (visível no app)' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form[key as keyof MediaFormData]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                  </label>
                ))}
              </div>

              {/* Publish status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status de publicação</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const sel = form.publish_status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, publish_status: opt.value }))}
                        style={sel ? { borderColor: opt.color, color: opt.color, backgroundColor: opt.color + '18' } : {}}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${sel ? '' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'}`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t dark:border-slate-700 px-6 py-4 flex gap-2 justify-end bg-slate-50 dark:bg-slate-800">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={saveForm}
                disabled={!form.title || saveMutation.isPending}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {saveMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isNew ? 'Criar conteúdo' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MediaRow ─────────────────────────────────────────────────────────────────

function MediaRow({
  item,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  item: MediaItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  const kind = KIND_OPTIONS.find(k => k.value === item.kind);
  const status = STATUS_OPTIONS.find(s => s.value === item.publish_status);
  const StatusIcon = status?.icon ?? Clock;
  const KindIcon = kind?.icon ?? Video;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 flex items-center gap-4 hover:border-purple-200 dark:hover:border-purple-900 transition-colors group">
      {/* Thumbnail / Kind indicator */}
      <div
        className="w-20 h-14 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: (kind?.color ?? '#7C3AED') + '22' }}
      >
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <KindIcon className="w-7 h-7" style={{ color: kind?.color ?? '#7C3AED' }} />
        )}
        {item.is_live_now && (
          <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
            LIVE
          </div>
        )}
        {item.is_featured && (
          <div className="absolute bottom-1 right-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          </div>
        )}
        {item.duration_seconds > 0 && (
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-medium px-1 rounded">
            {formatDuration(item.duration_seconds)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: (kind?.color ?? '#7C3AED') + '20', color: kind?.color ?? '#7C3AED' }}
          >
            {kind?.label}
          </span>
          {item.is_featured && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Destaque</span>}
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.title}</p>
        {item.subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</p>}
        <div className="flex items-center gap-3 mt-1">
          {item.view_count > 0 && (
            <span className="text-[11px] text-slate-400">{formatViews(item.view_count)} views</span>
          )}
          {item.published_at && (
            <span className="text-[11px] text-slate-400">
              {new Date(item.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
          {item.watch_url && (
            <a href={item.watch_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
              <ExternalLink className="w-3 h-3" /> Ver link
            </a>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <StatusIcon className="w-3.5 h-3.5" style={{ color: status?.color }} />
        <span className="text-xs font-medium" style={{ color: status?.color }}>{status?.label}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onTogglePublish}
          title={item.publish_status === 'published' ? 'Despublicar' : 'Publicar'}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {item.publish_status === 'published'
            ? <EyeOff className="w-4 h-4 text-slate-500" />
            : <Eye className="w-4 h-4 text-green-500" />}
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Pencil className="w-4 h-4 text-slate-500" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}
