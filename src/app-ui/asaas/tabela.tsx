/**
 * Tabela padrão das telas de Pagamentos: busca, ordenação por coluna,
 * paginação, exportação CSV e impressão — tudo sobre as linhas já carregadas.
 * E o filtro de período (Hoje · 7 dias · 30 dias · Intervalo).
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Printer, Search } from 'lucide-react';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Botao, Cartao, cx, hojeIso, inputCls } from './comum';

export interface Coluna<T> {
  chave: string;
  rotulo: string;
  /** Valor usado para ordenar, buscar, exportar e imprimir. */
  valor: (r: T) => string | number | null | undefined;
  /** Como aparece na tela (padrão: o valor). */
  render?: (r: T) => ReactNode;
  /** Texto no CSV/impressão quando difere do valor (ex.: moeda formatada). */
  texto?: (r: T) => string;
  alinhar?: 'esquerda' | 'direita' | 'centro';
  /** Coluna só de ações: sem ordenação, fora do CSV/impressão. */
  acao?: boolean;
  classe?: string;
}

interface Props<T> {
  titulo: string;
  linhas: T[];
  colunas: Coluna<T>[];
  chave: (r: T) => string;
  aoClicar?: (r: T) => void;
  ordemInicial?: { chave: string; desc?: boolean };
  porPagina?: number;
  vazio?: ReactNode;
  /** Conteúdo extra na barra (filtros), à esquerda da busca. */
  barra?: ReactNode;
  /** Linha de totais acima da tabela. */
  resumo?: ReactNode;
  busca?: boolean;
  carregando?: boolean;
  /** Período mostrado no cabeçalho da impressão. */
  subtitulo?: string;
}

const TAMANHOS = [10, 25, 50, 100];

function textoDe<T>(c: Coluna<T>, r: T) {
  if (c.texto) return c.texto(r);
  const v = c.valor(r);
  return v === null || v === undefined ? '' : String(v);
}

export function Tabela<T>({ titulo, linhas, colunas, chave, aoClicar, ordemInicial, porPagina = 25, vazio, barra, resumo, busca = true, carregando, subtitulo }: Props<T>) {
  const [termo, setTermo] = useState('');
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean } | null>(ordemInicial ? { chave: ordemInicial.chave, desc: Boolean(ordemInicial.desc) } : null);
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(porPagina);
  const dados = colunas.filter((c) => !c.acao);

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    let l = t ? linhas.filter((r) => dados.some((c) => textoDe(c, r).toLowerCase().includes(t))) : [...linhas];
    if (ordem) {
      const col = colunas.find((c) => c.chave === ordem.chave);
      if (col) {
        l = l.sort((a, b) => {
          const va = col.valor(a), vb = col.valor(b);
          if (va === vb) return 0;
          if (va === null || va === undefined || va === '') return 1;
          if (vb === null || vb === undefined || vb === '') return -1;
          const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
          return ordem.desc ? -r : r;
        });
      }
    }
    return l;
  }, [linhas, termo, ordem, colunas, dados]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / tamanho));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((atual - 1) * tamanho, atual * tamanho);

  function ordenar(c: Coluna<T>) {
    if (c.acao) return;
    setPagina(1);
    setOrdem((o) => (o?.chave === c.chave ? (o.desc ? null : { chave: c.chave, desc: true }) : { chave: c.chave, desc: false }));
  }

  function exportar() {
    const csv = [dados.map((c) => c.rotulo), ...filtradas.map((r) => dados.map((c) => textoDe(c, r)))]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    a.download = `${titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${hojeIso()}.csv`;
    a.click();
  }

  function imprimir() {
    const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
    const cab = dados.map((c) => `<th style="text-align:${c.alinhar === 'direita' ? 'right' : 'left'}">${esc(c.rotulo)}</th>`).join('');
    const corpo = filtradas.map((r) => `<tr>${dados.map((c) => `<td style="text-align:${c.alinhar === 'direita' ? 'right' : 'left'}">${esc(textoDe(c, r))}</td>`).join('')}</tr>`).join('');
    // Quadro oculto em vez de janela nova: fechar a impressão não deixa aba "about:blank" aberta.
    const quadro = document.createElement('iframe');
    quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(quadro);
    const w = quadro.contentWindow;
    if (!w) {
      quadro.remove();
      return;
    }
    w.document.open();
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
      <style>body{font-family:system-ui,sans-serif;color:#0f172a;margin:24px}h1{font-size:18px;margin:0}p{color:#64748b;font-size:12px;margin:4px 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f1f5f9;color:#475569;font-weight:600}th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
      @media print{body{margin:0}}</style></head><body><h1>${esc(titulo)}</h1>
      <p>${esc(subtitulo ?? '')}${subtitulo ? ' · ' : ''}${filtradas.length} registros · impresso em ${new Date().toLocaleString('pt-BR')}</p>
      <table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table></body></html>`);
    w.document.close();
    const remover = () => setTimeout(() => quadro.remove(), 500);
    w.onafterprint = remover;
    setTimeout(() => {
      w.focus();
      w.print();
      remover(); // navegadores sem onafterprint: print() bloqueia até fechar a janela de impressão
    }, 50);
  }

  const alinhar = (c: Coluna<T>) => (c.alinhar === 'direita' ? 'text-right' : c.alinhar === 'centro' ? 'text-center' : 'text-left');

  return (
    <Cartao className="overflow-hidden">
      <div className="flex flex-wrap items-end gap-2 p-3 border-b border-slate-100 dark:border-slate-700">
        {barra}
        {busca && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Buscar nesta lista" value={termo} onChange={(e) => { setTermo(e.target.value); setPagina(1); }} />
          </div>
        )}
        <Botao tipo="secundario" onClick={exportar} disabled={!filtradas.length} title="Exportar CSV (abre no Excel)"><Download className="w-4 h-4" />Exportar</Botao>
        <Botao tipo="secundario" onClick={imprimir} disabled={!filtradas.length} title="Imprimir"><Printer className="w-4 h-4" />Imprimir</Botao>
      </div>
      {resumo && <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">{resumo}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
            <tr>
              {colunas.map((c) => (
                <th key={c.chave} className={cx('font-semibold px-4 py-2 whitespace-nowrap select-none', alinhar(c), !c.acao && 'cursor-pointer hover:text-slate-800 dark:hover:text-slate-200')} onClick={() => ordenar(c)}>
                  <span className={cx('inline-flex items-center gap-1', c.alinhar === 'direita' && 'flex-row-reverse')}>
                    {c.rotulo}
                    {!c.acao && (ordem?.chave === c.chave ? (ordem.desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {carregando && !linhas.length ? (
              <tr><td colSpan={colunas.length} className="px-4 py-8 text-center text-sm text-slate-400">Carregando…</td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={colunas.length} className="px-4 py-2">{vazio ?? <p className="py-6 text-center text-sm text-slate-400">Nenhum registro.</p>}</td></tr>
            ) : visiveis.map((r) => (
              <tr key={chave(r)} onClick={aoClicar ? () => aoClicar(r) : undefined} className={cx(aoClicar && 'cursor-pointer', 'hover:bg-slate-50 dark:hover:bg-slate-700/40')}>
                {colunas.map((c) => (
                  <td key={c.chave} className={cx('px-4 py-2', alinhar(c), c.classe)} onClick={c.acao ? (e) => e.stopPropagation() : undefined}>
                    {c.render ? c.render(r) : textoDe(c, r) || <span className="text-slate-400">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
        <span className="flex-1">{filtradas.length} registro{filtradas.length === 1 ? '' : 's'}{termo ? ` (de ${linhas.length})` : ''}</span>
        <select className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900" value={tamanho} onChange={(e) => { setTamanho(Number(e.target.value)); setPagina(1); }}>
          {TAMANHOS.map((n) => <option key={n} value={n}>{n} por página</option>)}
        </select>
        <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30" disabled={atual <= 1} onClick={() => setPagina(atual - 1)}><ChevronLeft className="w-4 h-4" /></button>
        <span>Página {atual} de {paginas}</span>
        <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30" disabled={atual >= paginas} onClick={() => setPagina(atual + 1)}><ChevronRight className="w-4 h-4" /></button>
      </div>
    </Cartao>
  );
}

// ── Período ────────────────────────────────────────────────────────────────

export interface Periodo { de: string; ate: string }

const ATALHOS: { id: string; rotulo: string; dias: number }[] = [
  { id: 'hoje', rotulo: 'Hoje', dias: 0 },
  { id: '7', rotulo: '7 dias', dias: 6 },
  { id: '30', rotulo: '30 dias', dias: 29 },
];

export const periodoPadrao = (dias = 29): Periodo => ({ de: hojeIso(-dias), ate: hojeIso() });

export const rotuloPeriodo = (p: Periodo) => {
  const f = (s: string) => s.split('-').reverse().join('/');
  return p.de === p.ate ? f(p.de) : `${f(p.de)} a ${f(p.ate)}`;
};

/** Hoje · 7 dias · 30 dias · Intervalo (calendário De/Até). */
export function FiltroPeriodo({ valor, onChange }: { valor: Periodo; onChange: (p: Periodo) => void }) {
  const ativo = ATALHOS.find((a) => valor.ate === hojeIso() && valor.de === hojeIso(-a.dias))?.id ?? 'intervalo';
  // O calendário avisa início e depois fim, em sequência: guarda o início e repassa os dois juntos no fim.
  const inicio = useRef<string | null>(null);
  const mudar = (parte: Partial<Periodo>) => onChange({ ...valor, ...parte });
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Período</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          {ATALHOS.map((a) => (
            <button key={a.id} type="button" onClick={() => mudar({ de: hojeIso(-a.dias), ate: hojeIso() })}
              className={cx('px-3 py-2 text-xs font-semibold transition-colors', ativo === a.id ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800')}>
              {a.rotulo}
            </button>
          ))}
          <span className={cx('px-3 py-2 text-xs font-semibold', ativo === 'intervalo' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-400')}>Intervalo</span>
        </div>
        <DateRangePicker from={valor.de} to={valor.ate} onChangeFrom={(de) => { inicio.current = de; }} onChangeTo={(ate) => { mudar({ de: inicio.current ?? valor.de, ate }); inicio.current = null; }} />
      </div>
    </div>
  );
}
