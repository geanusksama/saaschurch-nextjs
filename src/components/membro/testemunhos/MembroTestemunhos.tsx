"use client";

import { motion } from 'motion/react';
import { Loader2, Heart } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { useMembroContent } from '../useMembroContent';

const TEAL = '#2dd4bf';

interface Testemunho {
  id: string;
  autor: string;
  titulo: string;
  corpo: string;
  likes: number;
  created_at: string;
}

export default function MembroTestemunhos() {
  const { data: items, loading } = useMembroContent<Testemunho>('testemunhos');

  return (
    <MembroShell title="Testemunhos" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-4 py-4 pb-8 space-y-3">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-2xl">✨</p>
              <p className="text-sm text-white/30">Nenhum testemunho ainda.</p>
            </div>
          )}
          {!loading && items.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="px-4 py-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-bold text-white/85">{t.titulo}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">{t.autor}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Heart size={11} style={{ color: TEAL }} />
                  <span className="text-[10px]" style={{ color: TEAL }}>{t.likes}</span>
                </div>
              </div>
              <p className="text-xs text-white/55 leading-relaxed">{t.corpo}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </MembroShell>
  );
}
