import {
  BookOpen, Heart, Sun, Moon, Flame, Sparkles, Star, Cross, Globe, Users, Zap, Music2, Gift,
  Plus, Pencil, Trash2, X, Save, RefreshCw, Eye, EyeOff, Check, AlertCircle, ChevronDown,
  Headphones, Clock, BookMarked,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { apiBase as API } from '../../lib/apiBase';

// ─── Icon catalogue ──────────────────────────────────────────────────────────

type IconKey =
  | 'BookOpen' | 'Heart' | 'Sun' | 'Moon' | 'Flame' | 'Sparkles'
  | 'Star' | 'Cross' | 'Globe' | 'Users' | 'Zap' | 'Music2' | 'Gift' | 'Headphones' | 'BookMarked';

const ICON_CFG: Record<IconKey, { Icon: LucideIcon; bg: string; label: string }> = {
  BookOpen:   { Icon: BookOpen,   bg: 'bg-purple-600',  label: 'Reflexao'    },
  Heart:      { Icon: Heart,      bg: 'bg-rose-500',    label: 'Devocional'  },
  Sun:        { Icon: Sun,        bg: 'bg-orange-400',  label: 'Manha'       },
  Moon:       { Icon: Moon,       bg: 'bg-indigo-700',  label: 'Noturno'     },
  Flame:      { Icon: Flame,      bg: 'bg-pink-600',    label: 'Oracao'      },
  Sparkles:   { Icon: Sparkles,   bg: 'bg-violet-600',  label: 'Graca'       },
  Star:       { Icon: Star,       bg: 'bg-amber-500',   label: 'Especial'    },
  Cross:      { Icon: Cross,      bg: 'bg-slate-700',   label: 'Doutrina'    },
  Globe:      { Icon: Globe,      bg: 'bg-cyan-600',    label: 'Missoes'     },
  Users:      { Icon: Users,      bg: 'bg-teal-500',    label: 'Comunhao'    },
  Zap:        { Icon: Zap,        bg: 'bg-blue-600',    label: 'Evangelismo' },
  Music2:     { Icon: Music2,     bg: 'bg-green-600',   label: 'Louvor'      },
  Gift:       { Icon: Gift,       bg: 'bg-emerald-600', label: 'Benção'      },
  Headphones: { Icon: Headphones, bg: 'bg-sky-500',     label: 'Audio'       },
  BookMarked: { Icon: BookMarked, bg: 'bg-yellow-500',  label: 'Biblica'     },
};
const ALL_ICONS = Object.keys(ICON_CFG) as IconKey[];

const ACCENT_PRESETS = [
  '#7c3aed', '#6366f1', '#2563eb', '#0891b2', '#0d9488',
  '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777',
  '#9333ea', '#475569',
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyBreadEntry {
  id: string;
  campo_id: string;
  headquarters_id: string | null;
  church_id: string | null;
  audience_scope: 'headquarters' | 'church';
  title: string;
  summary: string;
  body_text: string;
  bible_reference: string;
  audio_url: string | null;
  audio_duration_seconds: number;
  accent_hex: string;
  icon_name: string;
  is_featured: boolean;
  active: boolean;
  published_at: string;
  likes_count?: number | string;
  created_at: string;
}

interface FormState {
  title: string;
  summary: string;
  bodyText: string;
  bibleReference: string;
  audioUrl: string;
  audioDurationSeconds: number;
  accentHex: string;
  iconName: IconKey;
  isFeatured: boolean;
  active: boolean;
  publishedAt: string;
  audienceScope: 'headquarters' | 'church';
}

const emptyForm = (): FormState => ({
  title: '',
  summary: '',
  bodyText: '',
  bibleReference: '',
  audioUrl: '',
  audioDurationSeconds: 0,
  accentHex: '#7c3aed',
  iconName: 'BookOpen',
  isFeatured: false,
  active: true,
  publishedAt: new Date().toISOString().slice(0, 10),
  audienceScope: 'headquarters',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function IconBadge({ name, hex }: { name: string; hex: string }) {
  const cfg = ICON_CFG[name as IconKey] || ICON_CFG.BookOpen;
  const IcIcon = cfg.Icon;
  return (
    <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl overflow-hidden shadow-md" style={{ background: hex || cfg.bg.replace('bg-', '') }}>
      <div className={`absolute inset-0 ${cfg.bg}`} />
      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
      <IcIcon className="relative z-10 h-6 w-6 text-white drop-shadow" />
    </div>
  );
}

function fmtDuration(secs: number) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

// ─── Icon Picker ─────────────────────────────────────────────────────────────

function IconPicker({ value, onChange, onClose }: { value: string; onChange: (v: IconKey) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-white">Escolher icone</span>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ALL_ICONS.map(k => {
            const cfg = ICON_CFG[k];
            const IcIcon = cfg.Icon;
            return (
              <button key={k} onClick={() => { onChange(k); onClose(); }} title={cfg.label}
                className={`relative flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl ${cfg.bg} overflow-hidden shadow transition-transform hover:scale-105 ${value === k ? 'ring-2 ring-white ring-offset-1' : ''}`}>
                <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                <span className="relative z-10 text-[9px] text-white/90 font-medium leading-none">{cfg.label}</span>
                {value === k && <Check className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow z-20" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Bible data ──────────────────────────────────────────────────────────────
// [ptName, apiSlug, chapters]
const BIBLE_BOOKS: [string, string, number][] = [
  ['Gênesis','genesis',50],['Êxodo','exodus',40],['Levítico','leviticus',27],
  ['Números','numbers',36],['Deuteronômio','deuteronomy',34],['Josué','joshua',24],
  ['Juízes','judges',21],['Rute','ruth',4],['1 Samuel','1+samuel',31],
  ['2 Samuel','2+samuel',24],['1 Reis','1+kings',22],['2 Reis','2+kings',25],
  ['1 Crônicas','1+chronicles',29],['2 Crônicas','2+chronicles',36],['Esdras','ezra',10],
  ['Neemias','nehemiah',13],['Ester','esther',10],['Jó','job',42],
  ['Salmos','psalms',150],['Provérbios','proverbs',31],['Eclesiastes','ecclesiastes',12],
  ['Cantares','song+of+solomon',8],['Isaías','isaiah',66],['Jeremias','jeremiah',52],
  ['Lamentações','lamentations',5],['Ezequiel','ezekiel',48],['Daniel','daniel',12],
  ['Oséias','hosea',14],['Joel','joel',3],['Amós','amos',9],['Obadias','obadiah',1],
  ['Jonas','jonah',4],['Miquéias','micah',7],['Naum','nahum',3],['Habacuque','habakkuk',3],
  ['Sofonias','zephaniah',3],['Ageu','haggai',2],['Zacarias','zechariah',14],
  ['Malaquias','malachi',4],['Mateus','matthew',28],['Marcos','mark',16],
  ['Lucas','luke',24],['João','john',21],['Atos','acts',28],['Romanos','romans',16],
  ['1 Coríntios','1+corinthians',16],['2 Coríntios','2+corinthians',13],
  ['Gálatas','galatians',6],['Efésios','ephesians',6],['Filipenses','philippians',4],
  ['Colossenses','colossians',4],['1 Tessalonicenses','1+thessalonians',5],
  ['2 Tessalonicenses','2+thessalonians',3],['1 Timóteo','1+timothy',6],
  ['2 Timóteo','2+timothy',4],['Tito','titus',3],['Filemom','philemon',1],
  ['Hebreus','hebrews',13],['Tiago','james',5],['1 Pedro','1+peter',5],
  ['2 Pedro','2+peter',3],['1 João','1+john',5],['2 João','2+john',1],
  ['3 João','3+john',1],['Judas','jude',1],['Apocalipse','revelation',22],
];

interface BibleVerse { verse: number; text: string; }

// ─── Main Component ──────────────────────────────────────────────────────────

export function DailyBread() {
  const campoId = localStorage.getItem('mrm_active_field_id') || '';
  const token   = localStorage.getItem('mrm_token') || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [entries, setEntries]     = useState<DailyBreadEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [loadErr, setLoadErr]     = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<DailyBreadEntry | null>(null);
  const [form, setForm]           = useState<FormState>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState('');
  const [showIcons, setShowIcons] = useState(false);

  const [delId, setDelId]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const [previewEntry, setPreviewEntry] = useState<DailyBreadEntry | null>(null);
  const [audioInputMode, setAudioInputMode] = useState<'url' | 'file'>('url');
  const [audioFileName, setAudioFileName] = useState('');

  // ── Bible browser ─────────────────────────────────────────────────────────
  const [showBible, setShowBible]         = useState(false);
  const [bibleBookIdx, setBibleBookIdx]   = useState(0);
  const [bibleChapter, setBibleChapter]   = useState(1);
  const [bibleVerses, setBibleVerses]     = useState<BibleVerse[]>([]);
  const [bibleLoading, setBibleLoading]   = useState(false);
  const [bibleError, setBibleError]       = useState('');

  const fetchBibleChapter = useCallback(async (bookIdx: number, chapter: number) => {
    setBibleLoading(true); setBibleError(''); setBibleVerses([]);
    try {
      const slug = BIBLE_BOOKS[bookIdx][1];
      const res = await fetch(`https://bible-api.com/${slug}+${chapter}?translation=almeida`);
      if (!res.ok) throw new Error('Erro ao buscar');
      const data = await res.json();
      setBibleVerses((data.verses as any[]).map(v => ({ verse: v.verse, text: v.text.trim() })));
    } catch (e: any) {
      setBibleError(e.message || 'Erro');
    } finally {
      setBibleLoading(false);
    }
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!campoId) return;
    setLoading(true); setLoadErr('');
    try {
      const res = await fetch(`${API}/daily-bread?campoId=${campoId}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      setEntries(await res.json());
    } catch (e: any) {
      setLoadErr(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [campoId]);

  useEffect(() => { load(); }, [load]);

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = entries.filter(e => {
    if (filterActive === 'active') return e.active;
    if (filterActive === 'inactive') return !e.active;
    return true;
  });

  // ── CRUD helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormErr('');
    setShowBible(false);
    setBibleVerses([]);
    setAudioInputMode('url');
    setAudioFileName('');
    setShowModal(true);
  }

  function openEdit(e: DailyBreadEntry) {
    setEditing(e);
    setShowBible(false);
    setBibleVerses([]);
    setAudioInputMode(e.audio_url?.startsWith('data:') ? 'file' : 'url');
    setAudioFileName('');
    setForm({
      title: e.title,
      summary: e.summary,
      bodyText: e.body_text,
      bibleReference: e.bible_reference,
      audioUrl: e.audio_url || '',
      audioDurationSeconds: e.audio_duration_seconds,
      accentHex: e.accent_hex || '#7c3aed',
      iconName: (e.icon_name as IconKey) || 'BookOpen',
      isFeatured: e.is_featured,
      active: e.active,
      publishedAt: e.published_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      audienceScope: e.audience_scope || 'headquarters',
    });
    setFormErr('');
    setShowModal(true);
    setPreviewEntry(null);
  }

  async function save() {
    if (!form.title.trim() || !form.summary.trim() || !form.bodyText.trim() || !form.bibleReference.trim()) {
      setFormErr('Preencha titulo, resumo, texto e referencia biblica.');
      return;
    }
    setSaving(true); setFormErr('');
    try {
      const payload = {
        campoId,
        audienceScope: form.audienceScope,
        title: form.title.trim(),
        summary: form.summary.trim(),
        bodyText: form.bodyText.trim(),
        bibleReference: form.bibleReference.trim(),
        audioUrl: form.audioUrl.trim() || null,
        audioDurationSeconds: Number(form.audioDurationSeconds) || 0,
        accentHex: form.accentHex,
        iconName: form.iconName,
        isFeatured: form.isFeatured,
        active: form.active,
        publishedAt: form.publishedAt,
      };
      const url = editing ? `${API}/daily-bread/${editing.id}` : `${API}/daily-bread`;
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setShowModal(false);
      await load();
    } catch (e: any) {
      setFormErr(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!delId) return;
    setDeleting(true);
    try {
      await fetch(`${API}/daily-bread/${delId}`, { method: 'DELETE', headers });
      setDelId(null);
      await load();
    } catch {
      setDelId(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-purple-500';
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400';
  const toggleCls = (on: boolean) => `relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${on ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pao Diario</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {entries.length} reflexo{entries.length !== 1 ? 'es' : ''} cadastrada{entries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilterActive(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filterActive === f ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
              {f === 'all' ? 'Todos' : f === 'active' ? 'Publicados' : 'Ocultos'}
            </button>
          ))}
          <button onClick={load} className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 transition-colors">
            <Plus className="h-4 w-4" /> Nova reflexao
          </button>
        </div>
      </div>

      {/* Error */}
      {loadErr && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {loadErr}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/30">
            <BookOpen className="h-8 w-8 text-purple-400" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma reflexao encontrada</p>
          <button onClick={openCreate} className="mt-4 text-sm font-semibold text-purple-600 hover:underline dark:text-purple-400">
            Adicionar primeira reflexao
          </button>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div className="space-y-3">
          {filtered.map(entry => {
            const likes = Number(entry.likes_count ?? 0);
            return (
              <div key={entry.id}
                className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                {/* Icon */}
                <div className="cursor-pointer" onClick={() => setPreviewEntry(entry)}>
                  <IconBadge name={entry.icon_name} hex={entry.accent_hex} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setPreviewEntry(entry)}>
                  <div className="flex flex-wrap items-start justify-between gap-1">
                    <p className="font-bold text-slate-900 dark:text-white leading-snug">{entry.title}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {entry.is_featured && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Destaque</span>
                      )}
                      {entry.active
                        ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">Publicado</span>
                        : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">Oculto</span>
                      }
                    </div>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{entry.summary}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <BookMarked className="h-3 w-3" />{entry.bible_reference}
                    </span>
                    {entry.audio_duration_seconds > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{fmtDuration(entry.audio_duration_seconds)}
                      </span>
                    )}
                    <span>{fmtDate(entry.published_at)}</span>
                    {likes > 0 && <span>❤ {likes}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(entry)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:border-slate-700 dark:hover:bg-purple-900/30 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDelId(entry.id)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-900/30 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────────────────── */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setPreviewEntry(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Colored header */}
            <div className="relative p-5 pb-4" style={{ background: previewEntry.accent_hex || '#7c3aed' }}>
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <IconBadge name={previewEntry.icon_name} hex={previewEntry.accent_hex} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">Pao Diario</p>
                    <h2 className="text-lg font-bold text-white leading-snug">{previewEntry.title}</h2>
                  </div>
                </div>
                <button onClick={() => setPreviewEntry(null)} className="rounded-lg p-1 hover:bg-white/20 transition-colors">
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{previewEntry.summary}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{previewEntry.body_text}</p>
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800">
                <BookMarked className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{previewEntry.bible_reference}</span>
                {previewEntry.audio_duration_seconds > 0 && (
                  <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{fmtDuration(previewEntry.audio_duration_seconds)}
                  </span>
                )}
              </div>
              {/* Audio player */}
              {previewEntry.audio_url && (
                <audio
                  key={previewEntry.id}
                  controls
                  className="w-full rounded-xl"
                  style={{ accentColor: previewEntry.accent_hex || '#7c3aed' }}
                >
                  <source src={previewEntry.audio_url} />
                  Seu navegador nao suporta audio.
                </audio>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span>{fmtDate(previewEntry.published_at)}</span>
                {previewEntry.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">Destaque</span>}
                {!previewEntry.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500">Oculto</span>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <button onClick={() => { openEdit(previewEntry); }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button onClick={() => { setDelId(previewEntry.id); setPreviewEntry(null); }}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white">{editing ? 'Editar reflexao' : 'Nova reflexao'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Icon + Title */}
              <div>
                <label className={labelCls}>Icone e Titulo *</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowIcons(true)}
                    className="flex-shrink-0 rounded-2xl overflow-hidden shadow-md hover:scale-105 transition-transform"
                    title="Escolher icone">
                    <IconBadge name={form.iconName} hex={form.accentHex} />
                  </button>
                  <input className={inputCls} placeholder="Titulo da reflexao"
                    value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
              </div>

              {/* Accent color */}
              <div>
                <label className={labelCls}>Cor do card</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {ACCENT_PRESETS.map(hex => (
                    <button key={hex} type="button"
                      onClick={() => setForm(p => ({ ...p, accentHex: hex }))}
                      className={`h-7 w-7 rounded-lg shadow transition-transform hover:scale-110 ${form.accentHex === hex ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`}
                      style={{ background: hex }} />
                  ))}
                  <input type="color" value={form.accentHex}
                    onChange={e => setForm(p => ({ ...p, accentHex: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded-lg border border-slate-200 p-0.5" title="Cor personalizada" />
                </div>
              </div>

              {/* Resumo */}
              <div>
                <label className={labelCls}>Resumo *</label>
                <input className={inputCls} placeholder="Resumo curto para o card"
                  value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} />
              </div>

              {/* Texto completo */}
              <div>
                <label className={labelCls}>Texto completo *</label>
                <textarea rows={5} className={inputCls + ' resize-none'} placeholder="Texto da reflexao para leitura..."
                  value={form.bodyText} onChange={e => setForm(p => ({ ...p, bodyText: e.target.value }))} />
              </div>

              {/* Referencia biblica */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls + ' mb-0'}>Referencia biblica *</label>
                  <button
                    type="button"
                    onClick={() => setShowBible(v => !v)}
                    className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                  >
                    <BookOpen className="h-3 w-3" />
                    {showBible ? 'Fechar Bíblia' : 'Abrir Bíblia'}
                  </button>
                </div>
                <input className={inputCls} placeholder="ex: Lamentacoes 3:22-23"
                  value={form.bibleReference} onChange={e => setForm(p => ({ ...p, bibleReference: e.target.value }))} />

                {/* Inline Bible browser */}
                {showBible && (
                  <div className="mt-2 rounded-2xl border border-purple-200 bg-white shadow-lg dark:border-purple-800 dark:bg-slate-900 overflow-hidden">
                    {/* Controls */}
                    <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100 dark:border-slate-800">
                      <select
                        className="flex-1 min-w-[140px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        value={bibleBookIdx}
                        onChange={e => { setBibleBookIdx(Number(e.target.value)); setBibleChapter(1); setBibleVerses([]); }}
                      >
                        {BIBLE_BOOKS.map(([name], i) => (
                          <option key={i} value={i}>{name}</option>
                        ))}
                      </select>
                      <select
                        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        value={bibleChapter}
                        onChange={e => { setBibleChapter(Number(e.target.value)); setBibleVerses([]); }}
                      >
                        {Array.from({ length: BIBLE_BOOKS[bibleBookIdx][2] }, (_, i) => i + 1).map(c => (
                          <option key={c} value={c}>Cap. {c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => fetchBibleChapter(bibleBookIdx, bibleChapter)}
                        disabled={bibleLoading}
                        className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {bibleLoading ? '...' : 'Buscar'}
                      </button>
                    </div>

                    {/* Verses */}
                    <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
                      {bibleError && (
                        <p className="p-2 text-xs text-red-500">{bibleError}</p>
                      )}
                      {!bibleLoading && !bibleError && bibleVerses.length === 0 && (
                        <p className="p-2 text-xs text-slate-400">Selecione o livro e o capítulo e clique em Buscar.</p>
                      )}
                      {bibleVerses.map(v => (
                        <button
                          key={v.verse}
                          type="button"
                          title="Clique para usar esta referência"
                          onClick={() => setForm(p => ({
                            ...p,
                            bibleReference: `${BIBLE_BOOKS[bibleBookIdx][0]} ${bibleChapter}:${v.verse}`,
                          }))}
                          className="group w-full text-left rounded-lg px-2 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                        >
                          <span className="mr-2 inline-block w-5 text-center text-[10px] font-bold text-purple-500">{v.verse}</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300">{v.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Audio */}
              <div className="space-y-2">
                <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                  <button type="button"
                    className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-colors ${
                      audioInputMode === 'url'
                        ? 'bg-white text-purple-700 shadow dark:bg-slate-700 dark:text-purple-300'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                    onClick={() => setAudioInputMode('url')}>
                    Link (URL)
                  </button>
                  <button type="button"
                    className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-colors ${
                      audioInputMode === 'file'
                        ? 'bg-white text-purple-700 shadow dark:bg-slate-700 dark:text-purple-300'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                    onClick={() => setAudioInputMode('file')}>
                    Arquivo (MP3, AAC…)
                  </button>
                </div>

                {audioInputMode === 'url' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>URL do audio</label>
                      <input className={inputCls} placeholder="https://..."
                        value={form.audioUrl} onChange={e => setForm(p => ({ ...p, audioUrl: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Duracao (segundos)</label>
                      <input type="number" min={0} className={inputCls} placeholder="180"
                        value={form.audioDurationSeconds || ''}
                        onChange={e => setForm(p => ({ ...p, audioDurationSeconds: Number(e.target.value) || 0 }))} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Selecionar arquivo de audio</label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 px-4 py-3 transition hover:border-purple-400 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/30">
                      <Music2 className="h-5 w-5 flex-shrink-0 text-purple-500" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
                        {audioFileName || 'Clique para escolher MP3, AAC, OGG…'}
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAudioFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const dataUrl = ev.target?.result as string;
                            setForm(p => ({ ...p, audioUrl: dataUrl }));
                            // auto-detect duration
                            const audio = new Audio(dataUrl);
                            audio.addEventListener('loadedmetadata', () => {
                              if (isFinite(audio.duration)) {
                                setForm(p => ({ ...p, audioDurationSeconds: Math.round(audio.duration) }));
                              }
                            });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {form.audioUrl?.startsWith('data:') && (
                      <div className="mt-2 flex items-center justify-between">
                        <audio controls className="h-8 w-full rounded-lg" src={form.audioUrl} />
                        <button type="button" className="ml-2 flex-shrink-0 text-xs text-red-500 hover:underline"
                          onClick={() => { setForm(p => ({ ...p, audioUrl: '', audioDurationSeconds: 0 })); setAudioFileName(''); }}>
                          Remover
                        </button>
                      </div>
                    )}
                    {form.audioDurationSeconds > 0 && (
                      <p className="mt-1 text-xs text-slate-400">Duracao detectada: {fmtDuration(form.audioDurationSeconds)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Data de publicacao + escopo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data de publicacao *</label>
                  <input type="date" className={inputCls}
                    value={form.publishedAt} onChange={e => setForm(p => ({ ...p, publishedAt: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Escopo</label>
                  <div className="relative">
                    <select className={inputCls + ' appearance-none pr-8'}
                      value={form.audienceScope} onChange={e => setForm(p => ({ ...p, audienceScope: e.target.value as 'headquarters' | 'church' }))}>
                      <option value="headquarters">Sede / Campo</option>
                      <option value="church">Igreja especifica</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-8">
                <label className="flex cursor-pointer items-center gap-2">
                  <button type="button" onClick={() => setForm(p => ({ ...p, active: !p.active }))} className={toggleCls(form.active)}>
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
                  </button>
                  <span className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                    {form.active ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
                    {form.active ? 'Publicado' : 'Oculto'}
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <button type="button" onClick={() => setForm(p => ({ ...p, isFeatured: !p.isFeatured }))} className={toggleCls(form.isFeatured)}>
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isFeatured ? 'translate-x-4' : ''}`} />
                  </button>
                  <span className="text-sm text-slate-700 dark:text-slate-300">Destaque</span>
                </label>
              </div>

              {formErr && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formErr}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
              <button onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 disabled:opacity-60 transition-colors">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Icon Picker ───────────────────────────────────────────────────── */}
      {showIcons && (
        <IconPicker value={form.iconName} onChange={k => setForm(p => ({ ...p, iconName: k }))} onClose={() => setShowIcons(false)} />
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDelId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="mb-1 font-bold text-slate-900 dark:text-white">Excluir reflexao?</h3>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Esta acao nao pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
