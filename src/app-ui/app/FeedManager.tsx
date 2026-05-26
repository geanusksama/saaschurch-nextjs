'use client';
import React, { useState, useMemo } from 'react';
import {
  Rss, Plus, Pencil, Trash2, Search, X, RefreshCw,
  Eye, EyeOff, Heart, MessageCircle, Image, Video,
  Music, MapPin, CheckCircle, Clock, ChevronDown,
  BadgeCheck, Send,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = 'image' | 'video' | 'audio';

interface FeedPost {
  id: string;
  campo_id: string;
  church_id: string | null;
  title: string | null;
  content: string;
  media_url: string | null;
  media_type: MediaType | null;
  author_name: string;
  author_avatar_url: string | null;
  author_verified: boolean;
  location: string | null;
  likes_count: number;
  comments_count: number;
  is_published: boolean;
  created_at: string;
}

interface FeedComment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface FormState {
  title: string;
  content: string;
  media_url: string | null;
  media_type: MediaType | null;
  author_name: string;
  author_avatar_url: string | null;
  author_verified: boolean;
  location: string | null;
  is_published: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  title: '', content: '', media_url: null, media_type: null,
  author_name: '', author_avatar_url: null, author_verified: false,
  location: null, is_published: false,
};

const MEDIA_CFG: Record<MediaType, { label: string; icon: React.ElementType }> = {
  image: { label: 'Imagem', icon: Image },
  video: { label: 'Vídeo',  icon: Video },
  audio: { label: 'Áudio',  icon: Music },
};

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return `${Math.floor(diff / 60000)}min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Post Preview Card ────────────────────────────────────────────────────────

function PostPreview({ post }: { post: FeedPost }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex-shrink-0">
          {post.author_avatar_url
            ? <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-bold">
                {post.author_name.charAt(0).toUpperCase()}
              </div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{post.author_name}</p>
            {post.author_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
          </div>
          {post.location && <p className="text-[11px] text-slate-400 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{post.location}</p>}
        </div>
        <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(post.created_at)}</span>
      </div>

      {/* Media */}
      {post.media_url && post.media_type === 'image' && (
        <img src={post.media_url} alt="" className="w-full max-h-64 object-cover" />
      )}
      {post.media_url && post.media_type === 'video' && (
        <div className="w-full aspect-video bg-slate-900 flex items-center justify-center gap-2">
          <Video className="w-8 h-8 text-white/40" />
          <span className="text-white/50 text-sm">Vídeo</span>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {post.title && <p className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{post.title}</p>}
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">{post.content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-3 pb-3">
        <span className="flex items-center gap-1 text-xs text-slate-500"><Heart className="w-4 h-4" />{post.likes_count}</span>
        <span className="flex items-center gap-1 text-xs text-slate-500"><MessageCircle className="w-4 h-4" />{post.comments_count}</span>
        <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${
          post.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
          {post.is_published ? 'Publicado' : 'Rascunho'}
        </span>
      </div>
    </div>
  );
}

// ─── Comments Panel ────────────────────────────────────────────────────────────

function CommentsPanel({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<FeedComment[]>({
    queryKey: ['feed-comments', post.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_post_comments').select('id, author_name, content, created_at')
        .eq('post_id', post.id).order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeedComment[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feed_post_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-comments', post.id] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full flex flex-col rounded-l-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Comentários · {post.comments_count}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />)}</div>}
          {!isLoading && comments.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum comentário ainda</p>
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 group">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                {c.author_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-0.5">{c.author_name}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{c.content}</p>
                <p className="text-[11px] text-slate-400 mt-1">{fmtDate(c.created_at)}</p>
              </div>
              <button
                onClick={() => { if (confirm('Excluir comentário?')) deleteMut.mutate(c.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-rose-400 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FeedManager() {
  const qc   = useQueryClient();
  const user = getStoredUser();
  const campoId: string | undefined = user.campoId;

  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<'all' | 'published' | 'draft'>('all');
  const [editing, setEditing] = useState<FeedPost | null>(null);
  const [isNew, setIsNew]     = useState(false);
  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [previewPost, setPreviewPost] = useState<FeedPost | null>(null);
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);

  const showForm = isNew || editing !== null;

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: posts = [], isLoading, refetch } = useQuery<FeedPost[]>({
    queryKey: ['feed-posts', campoId, filter],
    queryFn: async () => {
      let q = supabase.from('feed_posts').select('*').order('created_at', { ascending: false });
      if (campoId) q = q.eq('campo_id', campoId);
      if (filter === 'published') q = q.eq('is_published', true);
      if (filter === 'draft')     q = q.eq('is_published', false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      if (!campoId) throw new Error('Campo não identificado.');
      const base = {
        campo_id: campoId,
        title:     payload.title    || null,
        content:   payload.content,
        media_url: payload.media_url,  media_type: payload.media_type,
        author_name:       payload.author_name   || 'Igreja',
        author_avatar_url: payload.author_avatar_url,
        author_verified:   payload.author_verified,
        location:          payload.location,
        is_published:      payload.is_published,
      };
      if (payload.id) {
        const { error } = await supabase.from('feed_posts')
          .update({ ...base, updated_at: new Date().toISOString() }).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feed_posts').insert(base);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feed-posts'] }); closeForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feed_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from('feed_posts')
        .update({ is_published: val, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openNew() {
    setForm({ ...EMPTY_FORM, author_name: user.name ?? user.nome ?? 'Igreja' });
    setEditing(null); setIsNew(true);
  }

  function openEdit(p: FeedPost) {
    setForm({
      title: p.title ?? '', content: p.content,
      media_url: p.media_url, media_type: p.media_type,
      author_name: p.author_name, author_avatar_url: p.author_avatar_url,
      author_verified: p.author_verified,
      location: p.location, is_published: p.is_published,
    });
    setEditing(p); setIsNew(false);
  }

  function closeForm() { setIsNew(false); setEditing(null); }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  const filtered = posts.filter(p =>
    !search || p.content.toLowerCase().includes(search.toLowerCase()) ||
    (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    p.author_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Rss className="w-5 h-5 text-blue-500" />
              Feed do App
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie publicações visíveis no app</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Nova publicação
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar publicações..."
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(['all', 'published', 'draft'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                             : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : 'Rascunhos'}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i) => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />)}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
            <Rss className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma publicação encontrada</p>
            <p className="text-xs mt-1">Crie a primeira publicação do feed</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(post => (
            <div key={post.id} className="relative group">
              <PostPreview post={post} />
              {/* Overlay actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => togglePublish.mutate({ id: post.id, val: !post.is_published })}
                  className={`p-1.5 rounded-lg shadow-sm text-xs font-medium flex items-center gap-1 ${
                    post.is_published
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300'}`}
                  title={post.is_published ? 'Despublicar' : 'Publicar'}
                >
                  {post.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setCommentsPost(post)}
                  className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600">
                  <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button onClick={() => openEdit(post)}
                  className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => { if (confirm('Excluir publicação?')) deleteMut.mutate(post.id); }}
                  className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form Drawer ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={closeForm} />
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 h-full overflow-y-auto shadow-2xl flex flex-col rounded-l-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isNew ? 'Nova publicação' : 'Editar publicação'}
              </h2>
              <button onClick={closeForm} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-5">

              {/* Autor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nome do autor *</label>
                  <input value={form.author_name} onChange={e => setField('author_name', e.target.value)}
                    placeholder="Ex: Igreja Central Campinas"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Localização</label>
                  <input value={form.location ?? ''} onChange={e => setField('location', e.target.value || null)}
                    placeholder="Ex: Campinas, SP"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Avatar URL (opcional)</label>
                  <input value={form.author_avatar_url ?? ''} onChange={e => setField('author_avatar_url', e.target.value || null)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setField('author_verified', !form.author_verified)}
                      className={`w-10 h-5 rounded-full transition-colors flex items-center ${form.author_verified ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${form.author_verified ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <BadgeCheck className="w-4 h-4 text-blue-500" /> Verificado
                    </span>
                  </label>
                </div>
              </div>

              {/* Título (opcional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Título (opcional)</label>
                <input value={form.title} onChange={e => setField('title', e.target.value)}
                  placeholder="Título da publicação..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Conteúdo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Conteúdo *</label>
                <textarea value={form.content} onChange={e => setField('content', e.target.value)} rows={5}
                  placeholder="Escreva a publicação..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
                          sel ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}>
                        <Icon className="w-3.5 h-3.5" /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {form.media_type && (
                  <input value={form.media_url ?? ''} onChange={e => setField('media_url', e.target.value || null)}
                    placeholder={form.media_type === 'image' ? 'URL da imagem...' : form.media_type === 'video' ? 'URL do vídeo...' : 'URL do áudio...'}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Publicar agora</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Visível para usuários do app</p>
                </div>
                <div
                  onClick={() => setField('is_published', !form.is_published)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center ${form.is_published ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.is_published ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Preview */}
              {(form.content || form.media_url) && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Pré-visualização</p>
                  <PostPreview post={{
                    id: '', campo_id: '', church_id: null,
                    title: form.title || null,
                    content: form.content,
                    media_url: form.media_url, media_type: form.media_type,
                    author_name: form.author_name || 'Igreja',
                    author_avatar_url: form.author_avatar_url,
                    author_verified: form.author_verified,
                    location: form.location,
                    likes_count: 0, comments_count: 0,
                    is_published: form.is_published,
                    created_at: new Date().toISOString(),
                  }} />
                </div>
              )}

              {saveMut.error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                  {(saveMut.error as Error).message}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-2 justify-end bg-slate-50 dark:bg-slate-800/80 sticky bottom-0">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancelar</button>
              <button onClick={() => saveMut.mutate({ ...form, ...(editing ? { id: editing.id } : {}) })}
                disabled={saveMut.isPending || !form.content.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2">
                {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {form.is_published ? 'Publicar' : 'Salvar rascunho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Comments Panel ── */}
      {commentsPost && <CommentsPanel post={commentsPost} onClose={() => setCommentsPost(null)} />}
    </div>
  );
}
