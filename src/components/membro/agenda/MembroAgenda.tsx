"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { supabase } from '@/lib/supabaseClient';

const TEAL = '#2dd4bf';
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface Evento {
  id: string;
  title?: string;
  nome?: string;
  date?: string;
  data?: string;
  start_date?: string;
  description?: string;
  descricao?: string;
  color?: string;
}

export default function MembroAgenda() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const mm = String(month + 1).padStart(2, '0');
      const lastDay = new Date(year, month + 1, 0).getDate(); // correct last day
      const from = `${year}-${mm}-01`;
      const to   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
      const { data } = await supabase
        .from('tbeventos')
        .select('*')
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: true });
      setEventos(data || []);
      setLoading(false);
    })();
  }, [month, year]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <MembroShell title="Agenda Anual" showBack>
      <div className="h-full flex flex-col">
        {/* Month nav */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={prevMonth} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/06 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <motion.p key={`${year}-${month}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-bold text-white">
            {MONTHS[month]} {year}
          </motion.p>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/06 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {loading && <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-white/20" /></div>}
          {!loading && eventos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-2xl">📅</p>
              <p className="text-sm text-white/30">Nenhum evento neste mês.</p>
            </div>
          )}
          {!loading && eventos.length > 0 && (
            <div className="px-4 py-3 space-y-2.5 pb-6">
              {eventos.map((ev, i) => {
                const evDate = ev.data || ev.date || ev.start_date || '';
                const evTitle = ev.nome || ev.title || 'Evento';
                const evDesc = ev.descricao || ev.description || '';
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex gap-3 items-start px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex-shrink-0 w-10 text-center">
                      <p className="text-[10px] text-white/30 uppercase tracking-wide">{evDate ? new Date(evDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }) : ''}</p>
                      <p className="text-lg font-bold" style={{ color: ev.color || TEAL }}>{evDate ? new Date(evDate + 'T00:00:00').getDate() : '?'}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/85 leading-tight">{evTitle}</p>
                      {evDesc && <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{evDesc}</p>}
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
