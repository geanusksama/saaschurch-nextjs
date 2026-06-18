"use client";

import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { useMembroContent } from '../useMembroContent';

const TEAL = '#2dd4bf';

interface Lider {
  id: string;
  nome: string;
  cargo: string;
  descricao?: string;
  foto_url?: string;
  tipo: string;
  ordem: number;
}

export default function MembroLideranca() {
  const { data: lideres, loading } = useMembroContent<Lider>('lideranca');

  const grouped = lideres.reduce((acc, l) => {
    const cat = l.tipo || 'Liderança';
    const label = cat === 'bispo' ? 'Bispos' : cat === 'pastor' ? 'Pastores' : cat === 'diacono' ? 'Diáconos' : cat === 'evangelista' ? 'Evangelistas' : 'Outros';
    if (!acc[label]) acc[label] = [];
    acc[label].push(l);
    return acc;
  }, {} as Record<string, Lider[]>);

  return (
    <MembroShell title="Liderança" showBack>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-4 pb-8">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && lideres.length === 0 && <div className="flex items-center justify-center py-16"><p className="text-sm text-white/30">Nenhum registro encontrado.</p></div>}
          {!loading && Object.entries(grouped).map(([cat, list], gi) => (
            <motion.div key={cat} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.08 }} className="mb-8">
              <p className="text-[10px] font-semibold tracking-widest text-white/25 uppercase px-1 mb-3">{cat}</p>
              <div className="space-y-2.5">
                {list.map((l, i) => (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: gi * 0.08 + i * 0.04 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {l.foto_url ? (
                      <img src={l.foto_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${TEAL}33` }} />
                    ) : (
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: `${TEAL}18`, color: TEAL }}>
                        {l.nome.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/85 truncate">{l.nome}</p>
                      {l.cargo && <p className="text-[11px] text-white/35 mt-0.5">{l.cargo}</p>}
                      {l.descricao && <p className="text-[10px] text-white/25 mt-0.5 leading-relaxed">{l.descricao}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </MembroShell>
  );
}
