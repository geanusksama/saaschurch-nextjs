/**
 * Menu Mobile › uma tela (Secretaria, Eventos, Loja...). A tela é só um
 * cabeçalho com abas; cada aba é um recurso de src/lib/mobile/definicoes.ts
 * desenhado por MobileRecurso.
 */
import { useState } from 'react';
import { useParams } from 'react-router';
import { Smartphone } from 'lucide-react';
import { RECURSOS, TELAS, type TelaDef } from '../../lib/mobile/definicoes';
import { MobileRecurso } from './MobileRecurso';

export function CabecalhoMobile({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
        <Smartphone className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">{titulo}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

export function Abas({ abas, atual, onTrocar }: { abas: [string, string][]; atual: string; onTrocar: (k: string) => void }) {
  if (abas.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
      {abas.map(([k, rotulo]) => (
        <button key={k} onClick={() => onTrocar(k)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            atual === k ? 'border-purple-600 text-purple-700 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export default function MobileTela() {
  const { tela = '' } = useParams();
  const def = TELAS[tela];
  if (!def) return <div className="p-6 text-sm text-slate-500">Tela não encontrada.</div>;
  // key: trocar de tela pelo menu recomeça na primeira aba
  return <Tela key={def.chave} def={def} />;
}

function Tela({ def }: { def: TelaDef }) {
  const [aba, setAba] = useState(def.recursos[0]);
  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <CabecalhoMobile titulo={def.titulo} sub={def.sub} />
      <Abas abas={def.recursos.map((r) => [r, RECURSOS[r].titulo])} atual={aba} onTrocar={setAba} />
      {aba && <MobileRecurso key={aba} recurso={aba} />}
    </div>
  );
}
