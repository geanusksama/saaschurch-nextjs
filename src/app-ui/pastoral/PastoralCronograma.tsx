/**
 * Aba Cronograma da Gestão Pastoral.
 *
 *  - Matriz: as etapas do cronograma × os 3 grupos de chegada, mais as
 *    instâncias e o ritmo usados no disparo automático.
 *  - Acompanhamento: o resultado dos disparos, com a conversa de cada pessoa.
 *
 * Quem dispara é o cron /api/cron/pastoral-cronograma (vercel.json), lendo a
 * fila que nasce quando alguém é anexado ao cronograma no Pipeline.
 */

import { useState } from 'react';
import { Table2, MessagesSquare } from 'lucide-react';
import JourneyMatrixEditor from './JourneyMatrixEditor';
import JourneySends from './JourneySends';

type SubTab = 'matrix' | 'sends';

export default function PastoralCronograma() {
  const [tab, setTab] = useState<SubTab>('sends');

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('sends')}
          className={`h-8 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors
            ${tab === 'sends' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <MessagesSquare className="w-4 h-4" />
          Acompanhamento
        </button>
        <button
          onClick={() => setTab('matrix')}
          className={`h-8 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors
            ${tab === 'matrix' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Table2 className="w-4 h-4" />
          Matriz
        </button>
      </div>

      {/* montadas sob demanda: as duas fazem consultas próprias ao abrir */}
      <div className="flex-1 min-h-0">
        {tab === 'sends' ? <JourneySends /> : <JourneyMatrixEditor />}
      </div>
    </div>
  );
}
