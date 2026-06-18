"use client";

import { motion } from 'motion/react';
import { Play, Loader2, Mic } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { useMembroContent } from '../useMembroContent';

const TEAL = '#2dd4bf';

interface Media {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  kind: string;
  duration_seconds?: number;
  published_at: string;
  speaker_name?: string;
}

function fmtDuration(secs?: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const KIND_LABEL: Record<string, string> = { sermon: 'Pregação', short: 'Short', clip: 'Clip', podcast: 'Podcast' };

export default function MembroPregacoes() {
  const { data: items, loading } = useMembroContent<Media>('pregacoes');

  return (
    <MembroShell title="Pregações" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-4 py-4 pb-8 space-y-2.5">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-2xl">🎙️</p>
              <p className="text-sm text-white/30">Nenhuma pregação disponível.</p>
            </div>
          )}
          {!loading && items.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex gap-3 items-center px-3 py-3 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {m.thumbnail_url ? (
                <img src={m.thumbnail_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${TEAL}18` }}>
                  <Mic size={22} style={{ color: TEAL }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: `${TEAL}20`, color: TEAL }}>
                    {KIND_LABEL[m.kind] || m.kind}
                  </span>
                  {m.duration_seconds && <span className="text-[9px] text-white/25">{fmtDuration(m.duration_seconds)}</span>}
                </div>
                <p className="text-[13px] font-semibold text-white/85 leading-tight truncate">{m.title}</p>
                {m.speaker_name && <p className="text-[11px] text-white/35 mt-0.5">{m.speaker_name}</p>}
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${TEAL}18`, border: `1px solid ${TEAL}30` }}>
                <Play size={14} style={{ color: TEAL }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </MembroShell>
  );
}
