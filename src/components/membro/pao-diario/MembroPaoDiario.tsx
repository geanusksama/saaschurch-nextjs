"use client";

import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { useMembroContent } from '../useMembroContent';

const TEAL = '#2dd4bf';

interface DailyBread {
  id: string;
  title: string;
  verse_reference: string;
  verse_text: string;
  content: string;
  date: string;
  author?: string;
}

export default function MembroPaoDiario() {
  const { data, loading } = useMembroContent<DailyBread>('pao-diario');
  const entry = data[0] ?? null;

  return (
    <MembroShell title="Pão Diário" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-4 pb-8">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && !entry && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-3xl">🍞</p>
              <p className="text-sm text-white/30">Nenhuma devoção cadastrada ainda.</p>
            </div>
          )}
          {!loading && entry && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="text-center pt-2">
                <p className="text-[11px] uppercase tracking-widest font-medium mb-3" style={{ color: `${TEAL}99` }}>
                  {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h1 className="text-xl font-bold text-white leading-tight">{entry.title}</h1>
                {entry.author && <p className="text-xs text-white/30 mt-1">{entry.author}</p>}
              </div>

              <div className="rounded-2xl px-5 py-4 text-center" style={{ background: `${TEAL}12`, border: `1px solid ${TEAL}25` }}>
                <p className="text-sm font-semibold leading-relaxed italic" style={{ color: TEAL }}>&ldquo;{entry.verse_text}&rdquo;</p>
                <p className="text-[11px] mt-2 font-medium" style={{ color: `${TEAL}80` }}>{entry.verse_reference}</p>
              </div>

              <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[13px] text-white/65 leading-relaxed whitespace-pre-line">{entry.content}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </MembroShell>
  );
}
