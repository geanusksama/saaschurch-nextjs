"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Heart } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { supabase } from '@/lib/supabaseClient';

const TEAL = '#2dd4bf';

interface Testemunho {
  id: string;
  content?: string;
  text?: string;
  author_name?: string;
  author_photo?: string;
  created_at: string;
  likes_count?: number;
  approved?: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return 'hoje';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}sem`;
  return `${Math.floor(d / 30)}m`;
}

export default function MembroTestemunhos() {
  const [items, setItems] = useState<Testemunho[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_testemunhos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      setItems((data || []).filter((t: Testemunho) => t.approved !== false));
      setLoading(false);
    })();
  }, []);

  return (
    <MembroShell title="Testemunhos" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-4 py-3 pb-8">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-3xl">🙌</p>
              <p className="text-sm text-white/30">Nenhum testemunho ainda.</p>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((t, i) => {
                const text = t.content || t.text || '';
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="px-4 py-4 rounded-2xl relative overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="absolute top-3 right-4 text-4xl opacity-05 text-white">"</div>
                    <div className="flex items-center gap-2.5 mb-3">
                      {t.author_photo ? (
                        <img src={t.author_photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${TEAL}22`, color: TEAL }}>
                          {(t.author_name || 'A').charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/70 truncate">{t.author_name || 'Anônimo'}</p>
                      </div>
                      <span className="text-[10px] text-white/25 flex-shrink-0">{timeAgo(t.created_at)}</span>
                    </div>
                    <p className="text-sm text-white/65 leading-relaxed">{text}</p>
                    <div className="flex items-center gap-1.5 mt-3">
                      <Heart size={12} className="text-white/20" />
                      <span className="text-[10px] text-white/25">{t.likes_count || 0}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
