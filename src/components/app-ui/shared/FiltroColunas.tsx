'use client';

/**
 * Filtros de tabela no estilo Excel (pedido do dono, 03/11/2026).
 *
 * - `OpcoesMarcaveis` / `OpcaoUnica`: lista com caixa de marcar para os painéis
 *   de filtro, no lugar dos chips (que não deixavam ver o que estava marcado).
 * - `useTabelaColunas`: estado de colunas visíveis (engrenagem, salvo por tabela
 *   no navegador), filtro por coluna e ordenação.
 * - `CabecalhoFiltro`: cabeçalho clicável que abre o menu da coluna: ordenar,
 *   "com valor / vazio", faixa maior/menor (número e data) e a lista de valores
 *   com caixa de marcar, igual ao autofiltro do Excel.
 * - `EngrenagemColunas`: escolher quais colunas aparecem.
 *
 * Tudo acontece nas linhas que já estão carregadas na tela; não chama a API.
 * Atenção: classes com `bg-slate-900` + `text-white` no mesmo botão são
 * repintadas pela regra global de design-guide.css — por isso o marcado usa
 * `style` com a cor primária.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ChevronDown, ListFilter, Search, Settings2, X } from 'lucide-react';

const COR_MARCADO = 'var(--sl-primary, #0f172a)';
const FONTE = 'var(--font, inherit)';
export const VAZIO = '__vazio__';

/* ───────────────────────── caixa de marcar ───────────────────────── */

export function CaixaMarcar({ marcado, parcial = false, redondo = false }: { marcado: boolean; parcial?: boolean; redondo?: boolean }) {
  const ligado = marcado || parcial;
  return (
    <span
      aria-hidden
      className={`grid h-[18px] w-[18px] flex-none place-items-center border-[1.5px] transition-colors ${redondo ? 'rounded-full' : 'rounded-[5px]'} ${
        ligado ? '' : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900'
      }`}
      style={ligado ? { backgroundColor: COR_MARCADO, borderColor: COR_MARCADO, color: '#fff' } : undefined}
    >
      {redondo ? (
        marcado ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null
      ) : parcial && !marcado ? (
        <span className="h-[2px] w-2 rounded bg-current" />
      ) : marcado ? (
        <Check className="h-3 w-3" strokeWidth={3.2} />
      ) : null}
    </span>
  );
}

function LinhaMarcar({ marcado, parcial, redondo, onClick, children, destaque = true }: {
  marcado: boolean;
  parcial?: boolean;
  redondo?: boolean;
  onClick: () => void;
  children: ReactNode;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      role={redondo ? 'radio' : 'checkbox'}
      aria-checked={parcial && !marcado ? 'mixed' : marcado}
      onClick={onClick}
      className={`flex min-h-[40px] w-full min-w-0 items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left text-sm transition-colors ${
        marcado && destaque
          ? 'border-slate-300 bg-slate-50 font-semibold text-slate-900 dark:border-slate-500 dark:bg-slate-700/60 dark:text-white'
          : 'border-slate-200 font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/40'
      }`}
    >
      <CaixaMarcar marcado={marcado} parcial={parcial} redondo={redondo} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export type OpcaoFiltro = { valor: string; rotulo: string };

/**
 * Vários valores. `selecionados = null` significa "Todos" (sem filtro), mesma
 * convenção dos filtros das telas.
 */
export function OpcoesMarcaveis({ opcoes, selecionados, onChange, rotuloTodos = 'Todos', colunas = 2 }: {
  opcoes: OpcaoFiltro[];
  selecionados: string[] | null;
  onChange: (proximo: string[] | null) => void;
  rotuloTodos?: string;
  colunas?: 1 | 2;
}) {
  const nenhum = !selecionados?.length;
  const alternar = (valor: string) => {
    const base = selecionados ?? [];
    const proximo = base.includes(valor) ? base.filter((item) => item !== valor) : [...base, valor];
    onChange(proximo.length ? proximo : null);
  };
  return (
    <div className={`grid gap-1.5 ${colunas === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
      <LinhaMarcar marcado={nenhum} onClick={() => onChange(null)}>
        {rotuloTodos}
      </LinhaMarcar>
      {opcoes.map((opcao) => (
        <LinhaMarcar key={opcao.valor} marcado={!!selecionados?.includes(opcao.valor)} onClick={() => alternar(opcao.valor)}>
          {opcao.rotulo}
        </LinhaMarcar>
      ))}
    </div>
  );
}

/** Um valor só (botão de rádio). */
export function OpcaoUnica<V extends string>({ opcoes, valor, onChange, colunas = 2 }: {
  opcoes: Array<{ valor: V; rotulo: string }>;
  valor: V;
  onChange: (proximo: V) => void;
  colunas?: 1 | 2;
}) {
  return (
    <div role="radiogroup" className={`grid gap-1.5 ${colunas === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
      {opcoes.map((opcao) => (
        <LinhaMarcar key={opcao.valor} redondo marcado={valor === opcao.valor} onClick={() => onChange(opcao.valor)}>
          {opcao.rotulo}
        </LinhaMarcar>
      ))}
    </div>
  );
}

/* ───────────────────────── modelo das colunas ───────────────────────── */

type ValorBruto = string | number | Date | null | undefined | boolean;

export type CampoColuna<T> = {
  /** Identificador único na tabela. */
  id: string;
  /** Nome mostrado no menu (ex.: "Telefone", "E-mail"). */
  rotulo: string;
  valor: (linha: T) => ValorBruto;
  tipo?: 'texto' | 'numero' | 'data';
  /** Rótulo de exibição do valor na lista de valores. */
  formatar?: (valor: ValorBruto) => string;
  /** false = sem lista de valores (ex.: e-mail), só com/sem valor. Padrão: true. */
  listarValores?: boolean;
};

export type ColunaTabela<T> = {
  id: string;
  rotulo: string;
  /** Campos filtráveis desta coluna (uma coluna "Contato" pode ter Telefone e E-mail). */
  campos?: CampoColuna<T>[];
  /** Não pode ser escondida pela engrenagem (ex.: nome). */
  fixa?: boolean;
  /** Começa escondida. */
  ocultaPadrao?: boolean;
};

export type FiltroCampo = {
  vazio: 'todos' | 'com' | 'sem';
  /** Valores desmarcados na lista (chaves). */
  excluidos: string[];
  de?: string;
  ate?: string;
};

export type Ordenacao = { campo: string; direcao: 'asc' | 'desc' } | null;

function chaveDe(valor: ValorBruto): string {
  if (valor === null || valor === undefined || valor === '') return VAZIO;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? VAZIO : valor.toISOString().slice(0, 10);
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  const texto = String(valor).trim();
  return texto ? texto : VAZIO;
}

function paraData(valor: ValorBruto): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const data = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(data.getTime()) ? null : data;
}

function paraNumero(valor: ValorBruto): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const n = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function rotuloPadrao<T>(campo: CampoColuna<T>, valor: ValorBruto): string {
  if (campo.formatar) return campo.formatar(valor);
  if (campo.tipo === 'data') {
    const data = paraData(valor);
    return data ? data.toLocaleDateString('pt-BR') : '';
  }
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return valor === null || valor === undefined ? '' : String(valor);
}

function filtroAtivo(filtro?: FiltroCampo) {
  return !!filtro && (filtro.vazio !== 'todos' || filtro.excluidos.length > 0 || !!filtro.de || !!filtro.ate);
}

function passa<T>(linha: T, campo: CampoColuna<T>, filtro: FiltroCampo): boolean {
  const bruto = campo.valor(linha);
  const chave = chaveDe(bruto);
  const vazio = chave === VAZIO;
  if (filtro.vazio === 'com' && vazio) return false;
  if (filtro.vazio === 'sem' && !vazio) return false;
  if (filtro.excluidos.length && filtro.excluidos.includes(chave)) return false;
  if (filtro.de || filtro.ate) {
    if (vazio) return false;
    if (campo.tipo === 'data') {
      const data = paraData(bruto);
      if (!data) return false;
      const dia = data.toISOString().slice(0, 10);
      if (filtro.de && dia < filtro.de) return false;
      if (filtro.ate && dia > filtro.ate) return false;
    } else {
      const n = paraNumero(bruto);
      if (n === null) return false;
      const de = paraNumero(filtro.de);
      const ate = paraNumero(filtro.ate);
      if (de !== null && n < de) return false;
      if (ate !== null && n > ate) return false;
    }
  }
  return true;
}

function comparar<T>(campo: CampoColuna<T>, a: T, b: T): number {
  const va = campo.valor(a);
  const vb = campo.valor(b);
  const ka = chaveDe(va);
  const kb = chaveDe(vb);
  // Vazios sempre no fim, nas duas direções é tratado por quem chama.
  if (ka === VAZIO && kb === VAZIO) return 0;
  if (campo.tipo === 'numero') return (paraNumero(va) ?? 0) - (paraNumero(vb) ?? 0);
  if (campo.tipo === 'data') return (paraData(va)?.getTime() ?? 0) - (paraData(vb)?.getTime() ?? 0);
  return rotuloPadrao(campo, va).localeCompare(rotuloPadrao(campo, vb), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function lerVisiveis(chave: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const salvo = window.localStorage.getItem(`tabela-colunas:${chave}`);
    const lista = salvo ? JSON.parse(salvo) : null;
    return Array.isArray(lista) ? lista.filter((item) => typeof item === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * Estado da tabela: colunas visíveis, filtros por campo e ordenação.
 *
 * `ordenacaoExterna`: quando a tela já tem a própria ordenação, passe
 * `{ valor, onChange }` e o hook não reordena as linhas.
 */
export function useTabelaColunas<T>({ chave, colunas, linhas, ordenacaoExterna }: {
  chave: string;
  colunas: ColunaTabela<T>[];
  linhas: T[];
  ordenacaoExterna?: { valor: Ordenacao; onChange: (proxima: Ordenacao) => void };
}) {
  const [ocultas, setOcultas] = useState<string[]>(() => {
    const salvo = lerVisiveis(chave);
    if (salvo) return salvo;
    return colunas.filter((coluna) => coluna.ocultaPadrao).map((coluna) => coluna.id);
  });
  const [filtros, setFiltros] = useState<Record<string, FiltroCampo>>({});
  const [ordenacaoInterna, setOrdenacaoInterna] = useState<Ordenacao>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(`tabela-colunas:${chave}`, JSON.stringify(ocultas));
    } catch {
      /* navegador sem localStorage: só não lembra */
    }
  }, [chave, ocultas]);

  const campos = useMemo(() => {
    const mapa = new Map<string, CampoColuna<T>>();
    colunas.forEach((coluna) => coluna.campos?.forEach((campo) => mapa.set(campo.id, campo)));
    return mapa;
  }, [colunas]);

  const ordenacao = ordenacaoExterna ? ordenacaoExterna.valor : ordenacaoInterna;
  const setOrdenacao = ordenacaoExterna ? ordenacaoExterna.onChange : setOrdenacaoInterna;

  const filtrarLista = useCallback(
    (lista: T[], ignorar: string | null = null) =>
      lista.filter((linha) =>
        Object.entries(filtros).every(([id, filtro]) => {
          if (id === ignorar || !filtroAtivo(filtro)) return true;
          const campo = campos.get(id);
          return campo ? passa(linha, campo, filtro) : true;
        }),
      ),
    [campos, filtros],
  );

  const filtrarExceto = useCallback((ignorar: string | null) => filtrarLista(linhas, ignorar), [filtrarLista, linhas]);

  /** Aplica os filtros de coluna numa lista qualquer (ex.: todos os membros para imprimir/exportar). */
  const aplicarFiltros = useCallback((lista: T[]) => filtrarLista(lista), [filtrarLista]);

  const linhasFiltradas = useMemo(() => {
    const base = filtrarExceto(null);
    if (ordenacaoExterna || !ordenacao) return base;
    const campo = campos.get(ordenacao.campo);
    if (!campo) return base;
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      const va = chaveDe(campo.valor(a)) === VAZIO;
      const vb = chaveDe(campo.valor(b)) === VAZIO;
      if (va !== vb) return va ? 1 : -1;
      return comparar(campo, a, b) * sinal;
    });
  }, [campos, filtrarExceto, ordenacao, ordenacaoExterna]);

  /** Valores distintos de um campo, considerando os filtros das outras colunas (como no Excel). */
  const valoresDe = useCallback(
    (campoId: string) => {
      const campo = campos.get(campoId);
      if (!campo) return [] as Array<{ chave: string; rotulo: string; total: number }>;
      const contagem = new Map<string, { rotulo: string; total: number; bruto: ValorBruto }>();
      filtrarExceto(campoId).forEach((linha) => {
        const bruto = campo.valor(linha);
        const k = chaveDe(bruto);
        const atual = contagem.get(k);
        if (atual) atual.total += 1;
        else contagem.set(k, { rotulo: k === VAZIO ? '(Vazio)' : rotuloPadrao(campo, bruto) || k, total: 1, bruto });
      });
      const lista = Array.from(contagem.entries()).map(([k, info]) => ({ chave: k, rotulo: info.rotulo, total: info.total, bruto: info.bruto }));
      lista.sort((a, b) => {
        if (a.chave === VAZIO) return -1;
        if (b.chave === VAZIO) return 1;
        if (campo.tipo === 'numero') return (paraNumero(a.bruto) ?? 0) - (paraNumero(b.bruto) ?? 0);
        if (campo.tipo === 'data') return a.chave.localeCompare(b.chave);
        return a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
      return lista.map(({ chave: k, rotulo, total }) => ({ chave: k, rotulo, total }));
    },
    [campos, filtrarExceto],
  );

  const definirFiltro = useCallback((campoId: string, filtro: FiltroCampo | null) => {
    setFiltros((atual) => {
      const proximo = { ...atual };
      if (!filtro || !filtroAtivo(filtro)) delete proximo[campoId];
      else proximo[campoId] = filtro;
      return proximo;
    });
  }, []);

  const limparFiltros = useCallback(() => setFiltros({}), []);

  const visivel = useCallback((colunaId: string) => !ocultas.includes(colunaId), [ocultas]);
  const alternarColuna = useCallback((colunaId: string) => {
    setOcultas((atual) => (atual.includes(colunaId) ? atual.filter((id) => id !== colunaId) : [...atual, colunaId]));
  }, []);
  const restaurarColunas = useCallback(() => {
    setOcultas(colunas.filter((coluna) => coluna.ocultaPadrao).map((coluna) => coluna.id));
  }, [colunas]);

  const totalFiltros = Object.values(filtros).filter(filtroAtivo).length;

  return {
    colunas,
    linhas: linhasFiltradas,
    aplicarFiltros,
    filtros,
    totalFiltros,
    definirFiltro,
    limparFiltros,
    valoresDe,
    ordenacao,
    setOrdenacao,
    visivel,
    alternarColuna,
    restaurarColunas,
    ocultas,
  };
}

export type TabelaColunas<T> = ReturnType<typeof useTabelaColunas<T>>;

/* ───────────────────────── popover em portal ───────────────────────── */

function Flutuante({ ancora, aberto, onFechar, largura = 300, children }: {
  ancora: HTMLElement | null;
  aberto: boolean;
  onFechar: () => void;
  largura?: number;
  children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    if (!aberto || !ancora) return;
    const calcular = () => {
      const r = ancora.getBoundingClientRect();
      const larguraReal = Math.min(largura, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - larguraReal - 8));
      const abaixo = window.innerHeight - r.bottom - 12;
      const acima = r.top - 12;
      if (abaixo >= 320 || abaixo >= acima) setPos({ top: r.bottom + 6, left, maxH: Math.max(200, abaixo) });
      else setPos({ top: Math.max(8, r.top - 6 - Math.min(acima, 520)), left, maxH: Math.min(acima, 520) });
    };
    calcular();
    window.addEventListener('resize', calcular);
    window.addEventListener('scroll', calcular, true);
    return () => {
      window.removeEventListener('resize', calcular);
      window.removeEventListener('scroll', calcular, true);
    };
  }, [aberto, ancora, largura]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      const alvo = evento.target as Node;
      if (caixa.current?.contains(alvo) || ancora?.contains(alvo)) return;
      onFechar();
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto, ancora, onFechar]);

  if (!aberto || !pos || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={caixa}
      role="dialog"
      className="fixed z-[200] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm normal-case tracking-normal text-slate-900 shadow-[0_20px_50px_-12px_rgba(15,23,42,.35)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      style={{ top: pos.top, left: pos.left, width: Math.min(largura, window.innerWidth - 16), maxHeight: pos.maxH, fontFamily: FONTE }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ───────────────────────── menu da coluna ───────────────────────── */

function MenuCampo<T>({ tabela, campo, aviso, onFechar }: {
  tabela: TabelaColunas<T>;
  campo: CampoColuna<T>;
  aviso?: string;
  onFechar: () => void;
}) {
  const atual = tabela.filtros[campo.id];
  const [vazio, setVazio] = useState<FiltroCampo['vazio']>(atual?.vazio ?? 'todos');
  const [excluidos, setExcluidos] = useState<string[]>(atual?.excluidos ?? []);
  const [de, setDe] = useState(atual?.de ?? '');
  const [ate, setAte] = useState(atual?.ate ?? '');
  const [busca, setBusca] = useState('');

  const listar = campo.listarValores !== false;
  const valores = useMemo(() => (listar ? tabela.valoresDe(campo.id) : []), [campo.id, listar, tabela]);
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const visiveis = termo ? valores.filter((v) => v.rotulo.toLocaleLowerCase('pt-BR').includes(termo)) : valores;
  const marcadosVisiveis = visiveis.filter((v) => !excluidos.includes(v.chave)).length;
  const todosMarcados = marcadosVisiveis === visiveis.length;

  const alternarTodos = () => {
    const chaves = visiveis.map((v) => v.chave);
    setExcluidos((lista) => (todosMarcados ? Array.from(new Set([...lista, ...chaves])) : lista.filter((k) => !chaves.includes(k))));
  };

  const aplicar = () => {
    // Com busca digitada, igual ao Excel: aplica só o que aparece na busca.
    const excl = termo ? Array.from(new Set([...excluidos, ...valores.filter((v) => !visiveis.includes(v)).map((v) => v.chave)])) : excluidos;
    tabela.definirFiltro(campo.id, { vazio, excluidos: excl, de: de || undefined, ate: ate || undefined });
    onFechar();
  };

  const ordenar = (direcao: 'asc' | 'desc') => {
    tabela.setOrdenacao({ campo: campo.id, direcao });
    onFechar();
  };

  const ordenadoAqui = tabela.ordenacao?.campo === campo.id ? tabela.ordenacao.direcao : null;
  const rotulosOrdem =
    campo.tipo === 'numero' ? ['Menor → maior', 'Maior → menor'] : campo.tipo === 'data' ? ['Mais antigo → recente', 'Mais recente → antigo'] : ['A → Z', 'Z → A'];
  const tipoFaixa = campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : null;

  const botaoOrdem = (direcao: 'asc' | 'desc', rotulo: string) => (
    <button
      type="button"
      onClick={() => ordenar(direcao)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-2 py-2 text-[13px] font-semibold ${
        ordenadoAqui === direcao
          ? 'border-slate-400 bg-slate-100 dark:border-slate-400 dark:bg-slate-700'
          : 'border-slate-200 hover:border-slate-400 dark:border-slate-600'
      }`}
    >
      {direcao === 'asc' ? <ArrowUpNarrowWide className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
      {rotulo}
    </button>
  );

  return (
    <>
      <div className="flex flex-col gap-3 overflow-y-auto p-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">Ordenar</span>
          <div className="flex gap-1.5">
            {botaoOrdem('asc', rotulosOrdem[0])}
            {botaoOrdem('desc', rotulosOrdem[1])}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">Mostrar</span>
          <div className="flex flex-wrap gap-1.5">
            {([['todos', 'Todos'], ['com', `Com ${campo.rotulo.toLowerCase()}`], ['sem', `Sem ${campo.rotulo.toLowerCase()}`]] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={vazio === valor}
                onClick={() => setVazio(valor)}
                title={rotulo}
                className={`flex flex-auto items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 py-2 text-[12.5px] font-semibold ${
                  vazio === valor ? 'border-slate-400 bg-slate-50 dark:border-slate-400 dark:bg-slate-700/60' : 'border-slate-200 hover:border-slate-400 dark:border-slate-600'
                }`}
              >
                <CaixaMarcar marcado={vazio === valor} redondo />
                <span>{rotulo}</span>
              </button>
            ))}
          </div>
        </div>

        {tipoFaixa && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">
              {campo.tipo === 'data' ? 'Período' : 'Faixa'}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {campo.tipo === 'data' ? 'A partir de' : 'Maior ou igual a'}
                <input
                  type={tipoFaixa}
                  value={de}
                  onChange={(evento) => setDe(evento.target.value)}
                  className="h-9 w-full rounded-[10px] border border-slate-200 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {campo.tipo === 'data' ? 'Até' : 'Menor ou igual a'}
                <input
                  type={tipoFaixa}
                  value={ate}
                  onChange={(evento) => setAte(evento.target.value)}
                  className="h-9 w-full rounded-[10px] border border-slate-200 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
            </div>
          </div>
        )}

        {listar && (
          <div className="flex min-h-0 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">Valores</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Pesquisar"
                className="h-9 w-full rounded-[10px] border border-slate-200 bg-white pl-8 pr-2 text-[13px] text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-slate-200 p-1 dark:border-slate-600">
              {visiveis.length === 0 ? (
                <p className="px-2 py-3 text-center text-[13px] text-slate-500">Nenhum valor</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={alternarTodos}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <CaixaMarcar marcado={todosMarcados} parcial={marcadosVisiveis > 0} />
                    (Selecionar tudo)
                  </button>
                  {visiveis.map((item) => {
                    const marcado = !excluidos.includes(item.chave);
                    return (
                      <button
                        key={item.chave}
                        type="button"
                        onClick={() => setExcluidos((lista) => (marcado ? [...lista, item.chave] : lista.filter((k) => k !== item.chave)))}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <CaixaMarcar marcado={marcado} />
                        <span className={`min-w-0 flex-1 truncate ${item.chave === VAZIO ? 'italic text-slate-500' : ''}`}>{item.rotulo}</span>
                        <span className="flex-none text-[11px] tabular-nums text-slate-400">{item.total}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {aviso && <p className="text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">{aviso}</p>}
      </div>

      <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-700">
        <button
          type="button"
          onClick={() => {
            tabela.definirFiltro(campo.id, null);
            onFechar();
          }}
          className="h-9 rounded-[10px] border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={aplicar}
          className="h-9 flex-1 rounded-[10px] text-[13px] font-bold hover:brightness-110"
          style={{ backgroundColor: COR_MARCADO, color: '#fff' }}
        >
          Aplicar
        </button>
      </div>
    </>
  );
}

/**
 * Cabeçalho de coluna com menu de filtro/ordenação. Coloque dentro do `<th>`
 * (ou da célula do cabeçalho em grade). Sem `campos`, mostra só o rótulo.
 */
export function CabecalhoFiltro<T>({ tabela, colunaId, className = '', aviso, alinhar = 'esquerda' }: {
  tabela: TabelaColunas<T>;
  colunaId: string;
  className?: string;
  aviso?: string;
  alinhar?: 'esquerda' | 'direita' | 'centro';
}) {
  const coluna = tabela.colunas.find((item) => item.id === colunaId);
  const [aberto, setAberto] = useState(false);
  const [campoId, setCampoId] = useState<string | null>(null);
  const [ancora, setAncora] = useState<HTMLButtonElement | null>(null);
  const fechar = useCallback(() => setAberto(false), []);

  if (!coluna) return null;
  const campos = coluna.campos ?? [];
  const justificar = alinhar === 'direita' ? 'justify-end' : alinhar === 'centro' ? 'justify-center' : 'justify-start';
  if (!campos.length) return <span className={`flex items-center ${justificar} ${className}`}>{coluna.rotulo}</span>;

  const campo = campos.find((item) => item.id === campoId) ?? campos[0];
  const ativo = campos.some((item) => filtroAtivo(tabela.filtros[item.id]));
  const ordem = campos.find((item) => item.id === tabela.ordenacao?.campo) ? tabela.ordenacao?.direcao : null;

  return (
    <>
      <button
        ref={setAncora}
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        title={`Filtrar e ordenar: ${coluna.rotulo}`}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={`group/cab flex min-w-0 items-center gap-1 ${justificar} ${ativo || ordem ? 'text-slate-900 dark:text-white' : ''} ${className}`}
      >
        <span className="truncate">{coluna.rotulo}</span>
        {ordem ? <span className="text-[11px]">{ordem === 'asc' ? '↑' : '↓'}</span> : null}
        {ativo ? (
          <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px]" style={{ backgroundColor: COR_MARCADO, color: '#fff' }}>
            <ListFilter className="h-3 w-3" strokeWidth={2.6} />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 flex-none opacity-50 transition-opacity group-hover/cab:opacity-100" strokeWidth={2.4} />
        )}
      </button>
      <Flutuante ancora={ancora} aberto={aberto} onFechar={fechar} largura={340}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-slate-700">
          <ListFilter className="h-4 w-4 text-slate-500" />
          <span className="flex-1 truncate text-sm font-bold">{coluna.rotulo}</span>
          <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        {campos.length > 1 && (
          <div className="flex gap-1 border-b border-slate-100 px-3.5 py-2 dark:border-slate-700">
            {campos.map((item) => {
              const sel = item.id === campo.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCampoId(item.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                    sel ? 'border-slate-400 bg-slate-100 dark:border-slate-400 dark:bg-slate-700' : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300'
                  }`}
                >
                  {item.rotulo}
                  {filtroAtivo(tabela.filtros[item.id]) && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COR_MARCADO }} />}
                </button>
              );
            })}
          </div>
        )}
        <MenuCampo key={campo.id} tabela={tabela} campo={campo} aviso={aviso} onFechar={fechar} />
      </Flutuante>
    </>
  );
}

/** Engrenagem: escolher quais colunas aparecem. */
export function EngrenagemColunas<T>({ tabela, className = '' }: { tabela: TabelaColunas<T>; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [ancora, setAncora] = useState<HTMLButtonElement | null>(null);
  const fechar = useCallback(() => setAberto(false), []);
  const ocultaveis = tabela.colunas.filter((coluna) => coluna.rotulo);
  const escondidas = ocultaveis.filter((coluna) => !coluna.fixa && !tabela.visivel(coluna.id)).length;

  return (
    <>
      <button
        ref={setAncora}
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        title="Escolher colunas"
        aria-label="Escolher colunas"
        className={`relative grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white ${className}`}
      >
        <Settings2 className="h-[17px] w-[17px]" strokeWidth={2} />
        {escondidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold normal-case tracking-normal" style={{ backgroundColor: COR_MARCADO, color: '#fff' }}>
            {escondidas}
          </span>
        )}
      </button>
      <Flutuante ancora={ancora} aberto={aberto} onFechar={fechar} largura={260}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-slate-700">
          <Settings2 className="h-4 w-4 text-slate-500" />
          <span className="flex-1 text-sm font-bold">Colunas visíveis</span>
          <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
          {ocultaveis.map((coluna) => {
            const marcado = coluna.fixa || tabela.visivel(coluna.id);
            return (
              <button
                key={coluna.id}
                type="button"
                disabled={coluna.fixa}
                onClick={() => tabela.alternarColuna(coluna.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-700/50"
              >
                <CaixaMarcar marcado={!!marcado} />
                <span className="flex-1 truncate">{coluna.rotulo}</span>
                {coluna.fixa && <span className="text-[11px] text-slate-400">fixa</span>}
              </button>
            );
          })}
        </div>
        <div className="border-t border-slate-100 p-2 dark:border-slate-700">
          <button
            type="button"
            onClick={tabela.restaurarColunas}
            className="h-8 w-full rounded-[10px] text-[13px] font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Mostrar o padrão
          </button>
        </div>
      </Flutuante>
    </>
  );
}

/** Faixa "N filtros de coluna ativos · Limpar" para pôr acima da tabela. */
export function AvisoFiltrosColuna<T>({ tabela, total, filtradas, nota }: { tabela: TabelaColunas<T>; total: number; filtradas: number; nota?: string }) {
  if (!tabela.totalFiltros) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <ListFilter className="h-4 w-4" />
      <span>
        {tabela.totalFiltros} filtro{tabela.totalFiltros > 1 ? 's' : ''} de coluna · mostrando {filtradas} de {total}
        {nota ? <span className="text-slate-400"> · {nota}</span> : null}
      </span>
      <button type="button" onClick={tabela.limparFiltros} className="ml-auto font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-white">
        Limpar filtros de coluna
      </button>
    </div>
  );
}
