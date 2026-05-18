import { useState, useRef } from 'react';
import {
  Sun, Plus, Pencil, Trash2, Search, Calendar, X,
  BookOpen, Moon, Heart, Star, Flame, Music2,
  HandHeart, Sparkles, Lightbulb, Leaf, Feather, Coffee,
  Play, BookOpen as Read, Share2, Upload, Link, Volume2, ImageIcon,
  MoreVertical, BarChart2, Printer, FileSpreadsheet,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

const uid = () => Math.random().toString(36).slice(2);

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ICONS: { name: string; label: string; Icon: React.ElementType }[] = [
  { name: 'BookOpen',  label: 'Bíblia',      Icon: BookOpen   },
  { name: 'Sun',       label: 'Manhã',        Icon: Sun        },
  { name: 'Moon',      label: 'Noite',        Icon: Moon       },
  { name: 'Heart',     label: 'Amor',         Icon: Heart      },
  { name: 'Star',      label: 'Destaque',     Icon: Star       },
  { name: 'Flame',     label: 'Avivamento',   Icon: Flame      },
  { name: 'Music2',    label: 'Louvor',       Icon: Music2     },
  { name: 'Sparkles',  label: 'Milagres',     Icon: Sparkles   },
  { name: 'Lightbulb', label: 'Sabedoria',    Icon: Lightbulb  },
  { name: 'Leaf',      label: 'Renovação',    Icon: Leaf       },
  { name: 'HandHeart', label: 'Misericórdia', Icon: HandHeart  },
  { name: 'Feather',   label: 'Graça',        Icon: Feather    },
  { name: 'Coffee',    label: 'Reflexão',     Icon: Coffee     },
];

function DynamicIcon({ name, className, style }: { name?: string; className?: string; style?: React.CSSProperties }) {
  const found = ICONS.find(i => i.name === name);
  const Icon = found?.Icon ?? Sun;
  return <Icon className={className} style={style} />;
}

type LikesRow = { count: number };

type Entry = {
  id: string; title: string; summary?: string; bible_reference?: string;
  published_at: string; active: boolean; is_featured: boolean; accent_hex?: string;
  audience_scope?: string; body_text?: string; icon_name?: string;
  image_url?: string; audio_url?: string; audio_duration_seconds?: number;
  play_count?: number; read_count?: number; share_count?: number;
  likes?: LikesRow[];
};

const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-slate-900 dark:text-white';

type StatType = 'play' | 'read' | 'share' | 'likes';
type StatUser = { name: string; email: string; action_at: string };
type ExportTarget = { entryId: string; entryTitle: string; type: StatType; count: number };

const STAT_LABELS: Record<StatType, string> = {
  play: 'Ouviram o áudio', read: 'Leram', share: 'Compartilharam', likes: 'Curtiram',
};

async function fetchStatUsers(entryId: string, type: StatType): Promise<StatUser[]> {
  let raw: { user_id: string; created_at: string }[] = [];

  if (type === 'likes') {
    const { data } = await supabase
      .from('app_daily_bread_likes')
      .select('user_id, created_at')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false });
    raw = data ?? [];
  } else {
    const { data } = await supabase
      .from('app_daily_bread_interactions')
      .select('user_id, created_at')
      .eq('entry_id', entryId)
      .eq('type', type)
      .order('created_at', { ascending: false });
    raw = data ?? [];
  }

  if (raw.length === 0) return [];

  const userIds = [...new Set(raw.map(d => d.user_id))];
  let memberMap: Record<string, { nome: string; email: string }> = {};
  try {
    const { data: members } = await supabase
      .from('members')
      .select('id, nome, email')
      .in('id', userIds);
    if (members) {
      for (const m of members) memberMap[m.id] = { nome: m.nome ?? '', email: m.email ?? '' };
    }
  } catch { /* silently ignore */ }

  return raw.map(d => ({
    name:      memberMap[d.user_id]?.nome  ?? `Usuário ${d.user_id.slice(0, 8)}`,
    email:     memberMap[d.user_id]?.email ?? '',
    action_at: d.created_at,
  }));
}

function downloadCSV(users: StatUser[], target: ExportTarget) {
  const label = STAT_LABELS[target.type].replace(/ /g, '-');
  const header = 'Nome,Email,Data/Hora';
  const rows = users.map(u =>
    `"${u.name}","${u.email}","${new Date(u.action_at).toLocaleString('pt-BR')}"`
  );
  const csv = '﻿' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pao-diario-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function printUsers(users: StatUser[], target: ExportTarget) {
  const rows = users.map((u, i) =>
    `<tr><td>${i + 1}</td><td>${u.name}</td><td>${u.email}</td><td>${new Date(u.action_at).toLocaleString('pt-BR')}</td></tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><head><title>Pão Diário</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h2{margin-bottom:4px}p{color:#666;margin-bottom:14px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:13px;text-align:left}
    th{background:#f5f5f5;font-weight:600}@media print{button{display:none}}</style></head>
    <body><h2>${target.entryTitle}</h2>
    <p>${STAT_LABELS[target.type]} — ${users.length} pessoa${users.length !== 1 ? 's' : ''}</p>
    <table><thead><tr><th>#</th><th>Nome</th><th>Email</th><th>Data/Hora</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">Nenhum dado disponível</td></tr>'}</tbody>
    </table></body></html>`;
  const w = window.open('', '_blank', 'width=820,height=620');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

export default function AppDailyBread() {
  const queryClient = useQueryClient();
  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef  = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [audioMode, setAudioMode]  = useState<'url' | 'upload'>('url');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio]  = useState(false);

  const [form, setForm] = useState({
    title: '', summary: '', body_text: '', bible_reference: '',
    published_at: new Date().toISOString().slice(0, 10),
    accent_hex: '#f59e0b', icon_name: 'BookOpen',
    image_url: '', audio_url: '', audio_duration_seconds: 0,
    active: true, is_featured: false, audience_scope: 'headquarters',
  });
  const [error, setError] = useState('');

  // Stats / export
  const [statsEntry, setStatsEntry]   = useState<Entry | null>(null);
  const [exportTarget, setExportTarget] = useState<ExportTarget | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const user = getStoredUser();
  const campoId: string | undefined = user.campoId;

  // ── Query ────────────────────────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['daily-bread', campoId],
    queryFn: async () => {
      // Query principal — colunas que já existem no schema original
      // audio_url e audio_duration_seconds existem desde o início
      let query = supabase
        .from('app_daily_bread_entries')
        .select(`
          id, title, summary, body_text, icon_name, bible_reference,
          published_at, active, is_featured, accent_hex, audience_scope,
          audio_url, audio_duration_seconds
        `)
        .order('published_at', { ascending: false });
      if (campoId) query = query.eq('campo_id', campoId);
      const { data, error } = await query;
      if (error) throw error;
      const base = (data ?? []) as Entry[];
      if (base.length === 0) return base;

      // Query de colunas novas — requer migration 20260518_daily_bread_media.sql
      // Falha silenciosamente se ainda não existirem no banco
      try {
        const ids = base.map(e => e.id);

        const [mediaRes, statsRes, likesRes] = await Promise.all([
          supabase
            .from('app_daily_bread_entries')
            .select('id, image_url')
            .in('id', ids),
          supabase
            .from('app_daily_bread_entries')
            .select('id, play_count, read_count, share_count')
            .in('id', ids),
          supabase
            .from('app_daily_bread_likes')
            .select('entry_id')
            .in('entry_id', ids),
        ]);

        const mediaMap  = Object.fromEntries((mediaRes.data  ?? []).map(m => [m.id, m]));
        const statsMap  = Object.fromEntries((statsRes.data  ?? []).map(s => [s.id, s]));
        const likesCount: Record<string, number> = {};
        for (const l of (likesRes.data ?? [])) {
          likesCount[l.entry_id] = (likesCount[l.entry_id] ?? 0) + 1;
        }

        return base.map(e => ({
          ...e,
          image_url:   mediaMap[e.id]?.image_url   ?? undefined,
          play_count:  statsMap[e.id]?.play_count  ?? 0,
          read_count:  statsMap[e.id]?.read_count  ?? 0,
          share_count: statsMap[e.id]?.share_count ?? 0,
          likes: [{ count: likesCount[e.id] ?? 0 }],
        }));
      } catch {
        // Migration ainda não executada — retorna sem stats/imagem
        return base;
      }
    },
  });

  // ── Upload helpers ───────────────────────────────────────────────────────
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `daily-bread/${uid()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('dados').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('dados').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: publicUrl }));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setUploadingImage(false); }
  };

  const handleAudioUpload = async (file: File) => {
    setUploadingAudio(true);
    try {
      const ext = file.name.split('.').pop() ?? 'mp3';
      const path = `daily-bread/audio/${uid()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('dados').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('dados').getPublicUrl(path);
      setForm(f => ({ ...f, audio_url: publicUrl }));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setUploadingAudio(false); }
  };

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: form.title,
        summary: form.summary || null,
        body_text: form.body_text || null,
        bible_reference: form.bible_reference || null,
        published_at: form.published_at,
        accent_hex: form.accent_hex,
        icon_name: form.icon_name,
        image_url: form.image_url || null,
        audio_url: form.audio_url || null,
        audio_duration_seconds: form.audio_duration_seconds || 0,
        active: form.active,
        is_featured: form.is_featured,
        audience_scope: form.audience_scope,
      };
      if (!editing) {
        if (!campoId) throw new Error('Campo não identificado. Faça login novamente.');
        payload.campo_id = campoId;
      }
      if (editing) {
        const { error } = await supabase.from('app_daily_bread_entries').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('app_daily_bread_entries').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['daily-bread'] }); closeModal(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('app_daily_bread_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-bread'] }),
  });

  // ── Modal helpers ────────────────────────────────────────────────────────
  const blankForm = () => ({
    title: '', summary: '', body_text: '', bible_reference: '',
    published_at: new Date().toISOString().slice(0, 10),
    accent_hex: '#f59e0b', icon_name: 'BookOpen',
    image_url: '', audio_url: '', audio_duration_seconds: 0,
    active: true, is_featured: false, audience_scope: 'headquarters',
  });

  const openNew = () => {
    setEditing(null); setForm(blankForm()); setError('');
    setImageMode('url'); setAudioMode('url');
    setModalOpen(true);
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm({
      title: e.title, summary: e.summary ?? '', body_text: e.body_text ?? '',
      bible_reference: e.bible_reference ?? '',
      published_at: e.published_at?.slice(0, 10) ?? '',
      accent_hex: e.accent_hex ?? '#f59e0b', icon_name: e.icon_name ?? 'BookOpen',
      image_url: e.image_url ?? '', audio_url: e.audio_url ?? '',
      audio_duration_seconds: e.audio_duration_seconds ?? 0,
      active: e.active, is_featured: e.is_featured,
      audience_scope: e.audience_scope ?? 'headquarters',
    });
    setImageMode(e.image_url ? 'url' : 'url');
    setAudioMode(e.audio_url ? 'url' : 'url');
    setError(''); setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.title.trim() || !form.published_at) { setError('Título e data são obrigatórios'); return; }
    setError(''); saveMutation.mutate();
  };

  const filtered = entries.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Sun className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pão Diário</h1>
            <p className="text-slate-500 dark:text-slate-400">Devocionais publicados no app</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Entrada
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-slate-900 dark:text-white"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando entradas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sun className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhuma entrada encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => {
            const likesCount = entry.likes?.[0]?.count ?? 0;
            return (
              <div key={entry.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-4">
                {/* Ícone ou imagem */}
                <div className="shrink-0">
                  {entry.image_url ? (
                    <img src={entry.image_url} alt={entry.title}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: (entry.accent_hex ?? '#f59e0b') + '25' }}>
                      <DynamicIcon name={entry.icon_name} className="w-6 h-6" style={{ color: entry.accent_hex ?? '#f59e0b' }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{entry.title}</p>
                    {entry.is_featured && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full shrink-0">Destaque</span>}
                    {!entry.active && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full shrink-0">Inativo</span>}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(entry.published_at).toLocaleDateString('pt-BR')}</span>
                    {entry.bible_reference && <span>{entry.bible_reference}</span>}
                    {entry.audio_url && entry.audio_duration_seconds ? (
                      <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" />{formatDuration(entry.audio_duration_seconds)}</span>
                    ) : entry.audio_url ? (
                      <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" />áudio</span>
                    ) : null}
                  </div>

                  {entry.summary && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{entry.summary}</p>}

                  {/* Stats */}
                  {((entry.play_count ?? 0) + (entry.read_count ?? 0) + (entry.share_count ?? 0) + likesCount) > 0 && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {(entry.play_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Play className="w-3 h-3" />{entry.play_count}
                        </span>
                      )}
                      {(entry.read_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Read className="w-3 h-3" />{entry.read_count}
                        </span>
                      )}
                      {(entry.share_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Share2 className="w-3 h-3" />{entry.share_count}
                        </span>
                      )}
                      {likesCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-rose-400">
                          <Heart className="w-3 h-3 fill-rose-400" />{likesCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setStatsEntry(entry)}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(entry)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm('Excluir esta entrada?')) deleteMutation.mutate(entry.id); }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Engajamento (3 pontos) ─────────────────────────────── */}
      {statsEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-yellow-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Engajamento</h3>
              </div>
              <button onClick={() => setStatsEntry(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="px-5 pt-3 pb-1 text-xs text-slate-500 truncate">{statsEntry.title}</p>
            <div className="p-5 grid grid-cols-2 gap-3">
              {([
                { type: 'play'  as StatType, Icon: Play,    label: 'Ouviram áudio', count: statsEntry.play_count  ?? 0, color: 'text-blue-500',   bg: 'bg-blue-50   dark:bg-blue-900/20'   },
                { type: 'read'  as StatType, Icon: Read,    label: 'Leram',         count: statsEntry.read_count  ?? 0, color: 'text-green-500',  bg: 'bg-green-50  dark:bg-green-900/20'  },
                { type: 'share' as StatType, Icon: Share2,  label: 'Compartilharam',count: statsEntry.share_count ?? 0, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                { type: 'likes' as StatType, Icon: Heart,   label: 'Curtiram',      count: statsEntry.likes?.[0]?.count ?? 0, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
              ] as const).map(({ type, Icon, label, count, color, bg }) => (
                <button key={type}
                  onClick={() => {
                    setExportTarget({ entryId: statsEntry.id, entryTitle: statsEntry.title, type, count });
                    setStatsEntry(null);
                  }}
                  className={`flex flex-col items-center gap-1 p-4 rounded-xl ${bg} hover:opacity-80 transition cursor-pointer`}
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-2xl font-bold text-slate-800 dark:text-white">{count}</span>
                  <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">clique p/ exportar</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Diálogo Imprimir / Exportar Excel ───────────────────────────── */}
      {exportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xs shadow-2xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <BarChart2 className="w-6 h-6 text-yellow-500" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Exportar lista</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                <span className="font-medium text-slate-700 dark:text-slate-300">{exportTarget.count}</span>{' '}
                {exportTarget.count === 1 ? 'pessoa' : 'pessoas'} —{' '}
                {STAT_LABELS[exportTarget.type]}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{exportTarget.entryTitle}</p>
            </div>

            {exportLoading ? (
              <p className="text-center text-sm text-slate-400 py-3 animate-pulse">Buscando dados...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    setExportLoading(true);
                    const users = await fetchStatUsers(exportTarget.entryId, exportTarget.type);
                    setExportLoading(false);
                    printUsers(users, exportTarget);
                    setExportTarget(null);
                  }}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition"
                >
                  <Printer className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Imprimir</span>
                </button>
                <button
                  onClick={async () => {
                    setExportLoading(true);
                    const users = await fetchStatUsers(exportTarget.entryId, exportTarget.type);
                    setExportLoading(false);
                    downloadCSV(users, exportTarget);
                    setExportTarget(null);
                  }}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition"
                >
                  <FileSpreadsheet className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Exportar Excel</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setExportTarget(null)}
              className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Edição ───────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl my-4">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing ? 'Editar Entrada' : 'Nova Entrada — Pão Diário'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400 px-6 pt-4">{error}</p>}

            <form onSubmit={handleSubmit}>
              <div className="p-6 grid md:grid-cols-2 gap-6">

                {/* ── Coluna esquerda ────────────────────────────── */}
                <div className="space-y-4">

                  {/* Ícone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ícone</label>
                    <div className="grid grid-cols-7 gap-1">
                      {ICONS.map(({ name, label, Icon }) => (
                        <button key={name} type="button" title={label}
                          onClick={() => setForm(f => ({ ...f, icon_name: name }))}
                          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition ${
                            form.icon_name === name
                              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600'
                              : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500'
                          }`}>
                          <Icon className="w-4 h-4" />
                          <span className="text-[8px] leading-tight truncate w-full text-center">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Título */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título *</label>
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} />
                  </div>

                  {/* Data + Cor */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data *</label>
                      <input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cor de destaque</label>
                      <input type="color" value={form.accent_hex} onChange={e => setForm(f => ({ ...f, accent_hex: e.target.value }))}
                        className="w-full h-10 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer" />
                    </div>
                  </div>

                  {/* Referência */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Referência Bíblica</label>
                    <input type="text" value={form.bible_reference} onChange={e => setForm(f => ({ ...f, bible_reference: e.target.value }))}
                      placeholder="Ex: João 3:16" className={inputCls} />
                  </div>

                  {/* Foto / Imagem */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Foto / Imagem</span>
                    </label>
                    <MediaInput
                      mode={imageMode} setMode={setImageMode}
                      value={form.image_url}
                      onChange={url => setForm(f => ({ ...f, image_url: url }))}
                      onFileSelect={handleImageUpload}
                      uploading={uploadingImage}
                      fileRef={imageRef}
                      accept="image/*"
                      uploadLabel="Selecionar imagem"
                      bucket="daily-bread"
                    />
                    {form.image_url && (
                      <div className="mt-2 relative inline-block">
                        <img src={form.image_url} alt="preview" className="h-20 rounded-lg object-cover border border-slate-200" />
                        <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Áudio */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Áudio</span>
                    </label>
                    <MediaInput
                      mode={audioMode} setMode={setAudioMode}
                      value={form.audio_url}
                      onChange={url => setForm(f => ({ ...f, audio_url: url }))}
                      onFileSelect={handleAudioUpload}
                      uploading={uploadingAudio}
                      fileRef={audioRef}
                      accept="audio/*"
                      uploadLabel="Selecionar áudio (MP3, AAC…)"
                      bucket="daily-bread/audio"
                    />
                    {form.audio_url && (
                      <div className="mt-2 space-y-2">
                        <audio controls src={form.audio_url} className="w-full h-8" />
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Duração (segundos)</label>
                          <input type="number" min="0" value={form.audio_duration_seconds}
                            onChange={e => setForm(f => ({ ...f, audio_duration_seconds: parseInt(e.target.value) || 0 }))}
                            placeholder="Ex: 447"
                            className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-slate-900 dark:text-white" />
                          {form.audio_duration_seconds > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">{formatDuration(form.audio_duration_seconds)}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audiência */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Audiência</label>
                    <select value={form.audience_scope} onChange={e => setForm(f => ({ ...f, audience_scope: e.target.value }))} className={inputCls}>
                      <option value="headquarters">Sede (todos do campo)</option>
                      <option value="church">Igreja específica</option>
                      <option value="global">Global</option>
                    </select>
                  </div>

                  {/* Checkboxes */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-yellow-500" />
                      Ativo
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4 accent-yellow-500" />
                      Destaque
                    </label>
                  </div>
                </div>

                {/* ── Coluna direita ─────────────────────────────── */}
                <div className="space-y-4 flex flex-col">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Resumo</label>
                    <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={3}
                      placeholder="Frase de abertura exibida no card do app..."
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Texto Completo
                      <span className="ml-1 text-xs text-slate-400 font-normal">(botão "Ler" do app)</span>
                    </label>
                    <textarea value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
                      placeholder="Texto devocional completo..."
                      className={`flex-1 ${inputCls} resize-none min-h-[240px]`}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end px-6 pb-5">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="px-5 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente reutilizável de upload/URL ──────────────────────────────────
function MediaInput({
  mode, setMode, value, onChange, onFileSelect, uploading, fileRef, accept, uploadLabel,
}: {
  mode: 'url' | 'upload';
  setMode: (m: 'url' | 'upload') => void;
  value: string;
  onChange: (url: string) => void;
  onFileSelect: (file: File) => void;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  uploadLabel: string;
  bucket: string;
}) {
  return (
    <>
      {/* Toggle */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden mb-2">
        <button type="button" onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition ${
            mode === 'url' ? 'bg-yellow-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}>
          <Link className="w-3 h-3" /> URL
        </button>
        <button type="button" onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition ${
            mode === 'upload' ? 'bg-yellow-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}>
          <Upload className="w-3 h-3" /> Upload
        </button>
      </div>

      {mode === 'url' ? (
        <input type="url" value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-slate-900 dark:text-white"
        />
      ) : (
        <>
          <input ref={fileRef} type="file" accept={accept} className="hidden"
            onChange={e => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-500 hover:border-yellow-400 hover:text-yellow-600 transition disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Enviando...' : uploadLabel}
          </button>
        </>
      )}
    </>
  );
}
