"use client";

import { motion } from 'motion/react';
import { Loader2, Heart, MessageCircle } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { useMembroContent } from '../useMembroContent';

const TEAL = '#2dd4bf';

interface FeedPost {
  id: string;
  title?: string;
  content: string;
  media_url?: string;
  media_type?: string;
  author_name: string;
  author_avatar_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
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
  const { data: posts, loading } = useMembroContent<FeedPost>('feed');

  return (
    <MembroShell title="Feed" showBack={false}>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto pb-4">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-2xl">📰</p>
              <p className="text-sm text-white/30">Nenhuma publicação ainda.</p>
            </div>
          )}
          {!loading && posts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="mb-px"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {/* Author */}
              <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
                {p.author_avatar_url ? (
                  <img src={p.author_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${TEAL}22`, color: TEAL }}>
                    {p.author_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white/80">{p.author_name}</p>
                </div>
                <span className="text-[10px] text-white/25">{timeAgo(p.created_at)}</span>
              </div>

              {/* Media */}
              {p.media_url && p.media_type === 'image' && (
                <img src={p.media_url} alt="" className="w-full max-h-72 object-cover" />
              )}

              {/* Content */}
              <div className="px-4 py-2.5">
                {p.title && <p className="text-sm font-semibold text-white/85 mb-1">{p.title}</p>}
                <p className="text-[12px] text-white/60 leading-relaxed">{p.content}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 pb-3">
                <button className="flex items-center gap-1.5">
                  <Heart size={15} className="text-white/25" />
                  <span className="text-[11px] text-white/25">{p.likes_count}</span>
                </button>
                <button className="flex items-center gap-1.5">
                  <MessageCircle size={15} className="text-white/25" />
                  <span className="text-[11px] text-white/25">{p.comments_count}</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </MembroShell>
  );
}
