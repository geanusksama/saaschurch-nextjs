/**
 * Prévia do modelo no balão do WhatsApp: variáveis trocadas pelos exemplos,
 * botões de resposta rápida abaixo do balão. Só apresentação.
 */
import { Reply } from 'lucide-react';

/** Troca {{n}} pelo exemplo; sem exemplo, mantém o marcador. */
export function aplicarExemplos(texto: string, exemplo: (n: number) => string | undefined): string {
  return texto.replace(/\{\{(\d+)\}\}/g, (m, n) => {
    const e = exemplo(Number(n));
    return e && e.trim() !== '' ? e : m;
  });
}

export type DadosPrevia = {
  cabecalho?: string;
  corpo: string;
  rodape?: string;
  botoes: string[];
  exemplo: (n: number) => string | undefined;
  exemploCabecalho?: string;
};

export default function PreviaWhatsApp({ cabecalho, corpo, rodape, botoes, exemplo, exemploCabecalho }: DadosPrevia) {
  const cab = cabecalho ? aplicarExemplos(cabecalho, () => exemploCabecalho) : '';
  const textoCorpo = aplicarExemplos(corpo, exemplo);
  const vazio = !cab && !textoCorpo.trim() && !rodape;
  const botoesValidos = botoes.filter((b) => b.trim() !== '');

  return (
    <div className="rounded-2xl bg-[#e7ded3] dark:bg-slate-900 p-4" aria-label="Prévia da mensagem">
      <div className="max-w-[18rem] mx-auto space-y-1.5">
        <div className="rounded-lg rounded-tl-none bg-white dark:bg-slate-700 px-3 py-2 shadow-sm space-y-1">
          {vazio && <p className="text-sm text-slate-400">A mensagem aparece aqui enquanto você escreve.</p>}
          {cab && <p className="text-sm font-bold text-slate-900 dark:text-slate-50 break-words">{cab}</p>}
          {textoCorpo.trim() !== '' && (
            <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{textoCorpo}</p>
          )}
          {rodape && <p className="text-xs text-slate-500 dark:text-slate-300 break-words">{rodape}</p>}
          {!vazio && <p className="text-right text-[10px] text-slate-400">12:00</p>}
        </div>
        {botoesValidos.map((b, i) => (
          <div
            key={i}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-sky-600 dark:text-sky-300 shadow-sm"
          >
            <Reply className="size-3.5 shrink-0" />
            <span className="break-words min-w-0">{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
