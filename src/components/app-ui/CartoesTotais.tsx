import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Faixa dos cartões de totais das telas de consulta (Membros, Batismo,
 * Consagração, Transferência…). Pedido do dono em 02/11/2026: sem barra de
 * rolagem (os cartões quebram linha) e com botão para recolher/expandir.
 *
 * Só apresentação: recebe os mesmos cartões de antes como `children`. O estado
 * aberto/fechado é visual e fica guardado só neste navegador.
 */
const CHAVE = 'sl-cartoes-totais-abertos';

function lerPreferencia(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== '0';
  } catch {
    return true;
  }
}

export function CartoesTotais({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(lerPreferencia);

  const alternar = () => {
    const novo = !aberto;
    setAberto(novo);
    try {
      window.localStorage.setItem(CHAVE, novo ? '1' : '0');
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  };

  return (
    <div className="flex min-w-0 flex-[1_1_auto] flex-wrap items-stretch gap-2">
      {aberto && children}
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        title={aberto ? 'Recolher totais' : 'Mostrar totais'}
        className={`flex flex-none items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-[#e8ecf1] bg-white text-[13px] font-semibold text-slate-600 hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
          aberto ? 'min-h-[54px] w-10' : 'min-h-[44px] px-3.5'
        }`}
      >
        {aberto ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            <span>Totais</span>
          </>
        )}
      </button>
    </div>
  );
}
