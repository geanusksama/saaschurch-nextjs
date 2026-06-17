"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Heart } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { supabase } from '@/lib/supabaseClient';

const TEAL = '#2dd4bf';

interface DailyEntry {
  id: string;
  title?: string;
  content?: string;
  bible_verse?: string;
  bible_reference?: string;
  date?: string;
  author_name?: string;
  author_photo?: string;
  likes_count?: number;
}

export default function MembroPaoDiario() {
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('app_daily_bread_entries')
        .select('*')
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      setEntry(data || null);
      setLoading(false);
    })();
  }, []);

  return (
    <MembroShell title="Pão Diário" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-4 pb-8">

          {loading && (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-white/20" /></div>
          )}

          {!loading && !entry && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <p className="text-3xl">🍞</p>
              <p className="text-sm text-white/30">Nenhum devocional disponível.</p>
            </div>
          )}

          {!loading && entry && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Date badge */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
                <span className="text-[10px] font-semibold tracking-widest text-white/25 uppercase px-2">
                  {entry.date ? new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Hoje'}
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {/* Bible verse */}
              {entry.bible_verse && (
                <div className="px-5 py-5 rounded-2xl relative overflow-hidden" style={{ background: `${TEAL}0d`, border: `1px solid ${TEAL}25` }}>
                  <div className="absolute top-3 right-4 text-4xl opacity-10" style={{ color: TEAL }}>"</div>
                  <p className="text-base text-white/85 leading-relaxed italic font-light relative z-10">{entry.bible_verse}</p>
                  {entry.bible_reference && (
                    <p className="text-xs font-semibold mt-3 relative z-10" style={{ color: TEAL }}>{entry.bible_reference}</p>
                  )}
                </div>
              )}

              {/* Title */}
              {entry.title && (
                <h2 className="text-xl font-bold text-white leading-tight">{entry.title}</h2>
              )}

              {/* Content */}
              {entry.content && (
                <div className="text-sm text-white/65 leading-relaxed space-y-3">
                  {entry.content.split('\n\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}

              {/* Author + likes */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {entry.author_photo && (
                    <img src={entry.author_photo} alt="" className="w-7 h-7 rounded-full object-cover" />
                  )}
                  {entry.author_name && (
                    <span className="text-xs text-white/40">{entry.author_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart size={13} className="text-white/25" />
                  <span className="text-xs text-white/30">{entry.likes_count || 0}</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
