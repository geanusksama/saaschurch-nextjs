"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Loader2, ExternalLink } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { supabase } from '@/lib/supabaseClient';

const TEAL = '#2dd4bf';

interface MediaItem {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  kind?: string;
  created_at: string;
  duration_seconds?: number;
}

const KIND_LABELS: Record<string, string> = {
  sermon: 'Sermão', short: 'Short', clip: 'Clipe', podcast: 'Podcast', live: 'Ao Vivo',
};
const KIND_ALL = ['all', 'sermon', 'short', 'clip', 'podcast'];

export default function MembroPregacoes() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const q = supabase.from('app_media_items').select('*').order('created_at', { ascending: false }).limit(40);
      if (filter !== 'all') q.eq('kind', filter);
      const { data } = await q;
      setItems(data || []);
      setLoading(false);
    })();
  }, [filter]);

  return (
    <MembroShell title="Pregações" showBack>
      <div className="h-full flex flex-col">
        {/* Filter tabs */}
        <div className="flex-shrink-0 flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {KIND_ALL.map(k => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={filter === k ? { background: TEAL, color: '#0d0f17' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
            >
              {k === 'all' ? 'Todos' : KIND_LABELS[k] || k}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && items.length === 0 && <div className="flex items-center justify-center py-16"><p className="text-sm text-white/30">Nenhuma pregação encontrada.</p></div>}
          {!loading && (
            <div className="px-4 py-3 space-y-3 pb-6">
              {items.map((item, i) => (
                <motion.a
                  key={item.id}
                  href={item.video_url || '#'}
                  target={item.video_url ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex gap-3 items-start rounded-2xl p-3 active:scale-[0.99] transition-transform"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={20} className="text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <Play size={12} className="text-white" />
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.kind && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${TEAL}18`, color: TEAL }}>{KIND_LABELS[item.kind] || item.kind}</span>}
                    </div>
                    <p className="text-xs font-semibold text-white/85 leading-tight line-clamp-2">{item.title}</p>
                    <p className="text-[10px] text-white/30 mt-1">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  {item.video_url && <ExternalLink size={13} className="text-white/20 flex-shrink-0 mt-0.5" />}
                </motion.a>
              ))}
            </div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
