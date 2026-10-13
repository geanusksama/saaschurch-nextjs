import { Search } from 'lucide-react';

/**
 * Botão "Buscar" das telas de consulta (Membros, Requerimentos, Batismo,
 * Consagração, Transferência).
 *
 * Regra das telas de consulta: abrem vazias, a pessoa define os filtros e só
 * então clica aqui. Mexer num filtro não consulta nada sozinho. Botão
 * destacado, com lupa — não um ícone discreto que passe despercebido.
 */
export function BotaoBuscar({ onClick, buscando }: { onClick: () => void; buscando?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={buscando}
      className="inline-flex w-full xl:w-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Search className="h-4 w-4" />
      {buscando ? 'Buscando...' : 'Buscar'}
    </button>
  );
}

/** Mensagem da tabela antes da primeira busca. */
export function AvisoDefinaFiltros() {
  return (
    <div className="px-6 py-10 text-center text-sm text-slate-500">
      Defina os filtros e clique em <strong>Buscar</strong>.
    </div>
  );
}

/**
 * Retrato dos filtros no momento do clique em Buscar. A tabela usa este
 * retrato, não o estado vivo dos campos: mexer num filtro não muda o
 * resultado até a próxima busca.
 */
export type FiltrosConsulta = {
  searchTerm: string;
  fieldId: string;
  regionalId: string;
  churchId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};
