/**
 * Busca e renderização em partes para as visões da Gestão de Culto.
 *
 * A busca filtra o que já veio do servidor (não faz consulta). A renderização
 * começa com INICIAL itens e acrescenta PASSO a cada vez que o fim da lista
 * aparece na tela: com mil igrejas, desenhar tudo de uma vez travava a tela.
 */
import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export const INICIAL = 20;
export const PASSO = 10;

/** "Vila Yolanda" casa com "vila yol", "VILA", "yolanda" — sem acento, sem caixa. */
export function casaBusca(texto: string | null | undefined, termo: string): boolean {
  const alvo = normalizar(termo);
  if (!alvo) return true;
  return normalizar(texto ?? '').includes(alvo);
}

function normalizar(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function CampoBusca({
  valor,
  onChange,
  placeholder = 'Buscar igreja…',
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Limpar busca"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Fim da lista: quando aparece na tela, pede mais PASSO itens. O botão fica
 * como alternativa (e para quem não rola, como leitor de tela).
 */
export function CarregarMais({ restantes, onMais }: { restantes: number; onMais: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMaisRef = useRef(onMais);
  useEffect(() => {
    onMaisRef.current = onMais;
  }, [onMais]);

  useEffect(() => {
    const el = ref.current;
    if (!el || restantes <= 0) return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) onMaisRef.current();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [restantes]);

  if (restantes <= 0) return null;
  return (
    <div ref={ref} className="py-2 text-center">
      <button
        type="button"
        onClick={onMais}
        className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline"
      >
        Mostrar mais {Math.min(PASSO, restantes)} (faltam {restantes})
      </button>
    </div>
  );
}
