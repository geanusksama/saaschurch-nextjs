"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, RefreshCw, Loader2 } from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { MembroShell } from '../MembroShell';
import { supabase } from '@/lib/supabaseClient';

const TEAL = '#2dd4bf';

interface FeedPost {
  id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_photo?: string;
  likes_count?: number;
  media_url?: string;
  media_type?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function MembroFeed() {
  const { session } = useMembroSession();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (session?.member.campoId) {
        query = query.eq('campo_id', session.member.campoId);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setPosts(data || []);
    } catch (e) {
      setError('Não foi possível carregar o feed.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.member.campoId]);

  if (!session) return null;

  return (
    <MembroShell title="Feed">
      <div className="h-full flex flex-col">
        {/* Sub-header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold text-white/50 tracking-wide uppercase">Comunidade</p>
          <button onClick={load} className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-white/20" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <p className="text-sm text-white/40">{error}</p>
              <button onClick={load} className="text-xs px-4 py-2 rounded-lg" style={{ background: `${TEAL}18`, color: TEAL }}>
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-3xl">💬</p>
              <p className="text-sm text-white/30">Nenhuma publicação ainda.</p>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <div className="px-4 py-3 space-y-3 pb-6">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Author */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    {post.author_photo ? (
                      <img src={post.author_photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${TEAL}22`, color: TEAL }}>
                        {(post.author_name || 'A').charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80 truncate">{post.author_name || 'AD Campinas'}</p>
                    </div>
                    <span className="text-[10px] text-white/25 flex-shrink-0">{timeAgo(post.created_at)}</span>
                  </div>

                  {/* Media */}
                  {post.media_url && post.media_type?.startsWith('image') && (
                    <img src={post.media_url} alt="" className="w-full object-cover max-h-64" />
                  )}

                  {/* Content */}
                  {post.content && (
                    <p className="px-4 pb-3 text-sm text-white/75 leading-relaxed">{post.content}</p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-3 px-4 pb-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-1.5 pt-3">
                      <Heart size={13} className="text-white/25" />
                      <span className="text-[11px] text-white/30">{post.likes_count || 0}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
