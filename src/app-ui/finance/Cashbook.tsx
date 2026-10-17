import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, Printer, Eye, AlertCircle, X, ChevronDown, ChevronLeft, ChevronRight,
  Pencil, Trash2, Filter, Save, Loader2, FileSpreadsheet, Share2,
  BarChart3, ArrowUp, ArrowDown, UserX, Wallet, ArrowDownLeft, ArrowUpRight,
  Church, Percent, Pin, PinOff, Heart, Gift, Clock, Activity, MoreHorizontal, CalendarDays, Building2,
} from 'lucide-react';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Link, useNavigate } from 'react-router';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { ReciboModal, printRecibo } from './ReciboModal';
import type { ReciboRow } from './ReciboModal';
import { RelatorioModal } from './RelatorioModal';
import { AnalyticsModal } from './AnalyticsModal';
import { ChurchPickerModal, type ChurchOption } from './ChurchPickerModal';
import { Permissao } from '../../lib/permissoes/Permissao';
import { FONTE_MODELO_FAMILIA, useFonteModelo } from '../../lib/fonteModelo';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * O PostgREST corta TODA resposta em 1.000 linhas, e o `.limit()` do cliente não
 * levanta esse teto — `limit=5000` voltava `content-range: 0-999/3426`. A
 * resposta cortada não vem marcada de forma nenhuma: chegava um recorte e os
 * cards de totais fechavam por cima dele como se fosse o período inteiro. Com
 * ~3.450 lançamentos por mês, uma consulta de um único mês já perdia mais de
 * dois mil lançamentos em silêncio.
 *
 * Aqui as páginas são pedidas por `range()` até a última vir incompleta.
 *
 * `MAX_LINHAS` é teto de navegador, não de banco: a tabela inteira tem mais de
 * 330 mil linhas e montar isso no cliente travaria a tela. Ao encostar no teto
 * a função devolve `truncado: true` e quem chama AVISA — número parcial nunca
 * pode ser servido como fechado, que é exatamente o defeito que isto corrige.
 */
const PAGINA_PGREST = 1000;
const MAX_LINHAS = 30000;

async function buscarTodasAsPaginas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null; truncado: boolean }> {
  const rows: T[] = [];

  for (let de = 0; de < MAX_LINHAS; de += PAGINA_PGREST) {
    const ate = Math.min(de + PAGINA_PGREST, MAX_LINHAS) - 1;
    const { data, error } = await pagina(de, ate);
    if (error) return { rows, error: error.message, truncado: false };

    const lote = (data as T[]) ?? [];
    rows.push(...lote);
    if (lote.length < ate - de + 1) return { rows, error: null, truncado: false };
  }

  // Enchemos o teto exatamente. Uma linha além dele diz se havia mais — sem esta
  // sondagem o aviso apareceria também no caso em que o período acabou junto com
  // o teto, e aviso que mente é tão ruim quanto silêncio.
  const { data: sobra, error: erroSobra } = await pagina(MAX_LINHAS, MAX_LINHAS);
  if (erroSobra) return { rows, error: erroSobra.message, truncado: false };
  return { rows, error: null, truncado: ((sobra as T[]) ?? []).length > 0 };
}

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function lastDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function normalizeText(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function exportToExcel(rows: import('./ReciboModal').ReciboRow[], dateFrom: string, dateTo: string) {
  const data = rows.map((r, i) => ({
    '#': i + 1,
    'Data': r.data_lancamento ? new Date(r.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR') : '',
    'Tipo': r.tipo,
    'Favorecido': r.favorecido ?? '',
    'Plano de Conta': r.plano_de_conta ?? '',
    'Categoria': r.categoria ?? '',
    'Forma Pgto': r.forma_pg ?? '',
    'Nº Doc': r.num_doc ?? '',
    'Referência': r.referencia ?? '',
    'Valor (R$)': Number(r.valor),
    'Igreja': r.churches?.name ?? '',
    'Observação': r.obs ?? '',
    'Operador': r.operador ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 25 },
    { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 28 }, { wch: 30 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Livro Caixa');

  const fileName = `livro-caixa_${dateFrom}_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function matchesStoredValue(currentValue: string | null | undefined, ...candidates: Array<string | null | undefined>) {
  const normalizedCurrent = normalizeText((currentValue || '').trim());
  if (!normalizedCurrent) return false;
  return candidates.some(candidate => normalizeText((candidate || '').trim()) === normalizedCurrent);
}

function filterTipoDocumentoOptions(
  docs: { id: string; nome: string; sigla: string | null }[],
  tipo: 'RECEITA' | 'DESPESA'
) {
  return docs.filter(doc => {
    const nome = doc.nome.toUpperCase();
    const temReceita = nome.includes('RECEITA');
    const temDespesa = nome.includes('DESPESA');
    if (tipo === 'RECEITA') return temReceita;
    return temDespesa || (!temReceita && !temDespesa);
  });
}

function resolveTipoDocumentoValue(
  currentValue: string,
  docs: { id: string; nome: string; sigla: string | null }[]
) {
  const match = docs.find(doc => matchesStoredValue(
    currentValue,
    doc.nome,
    doc.sigla,
    doc.sigla ? `${doc.sigla} - ${doc.nome}` : null,
  ));
  return match?.nome ?? currentValue;
}

function getReceitaTipoDocumentoFallback(
  planoDeContas: string,
  docs: { id: string; nome: string; sigla: string | null }[]
) {
  const planoNormalizado = normalizeText(planoDeContas || '');
  const isDizimoOuOferta = planoNormalizado.includes('dizimo') || planoNormalizado.includes('oferta');
  if (!isDizimoOuOferta) return '';

  const reciboReceita = docs.find(doc => normalizeText(doc.nome).includes('recibo receita'));
  if (reciboReceita) return reciboReceita.nome;

  const outrosReceita = docs.find(doc => normalizeText(doc.nome).includes('outros receita'));
  if (outrosReceita) return outrosReceita.nome;

  const primeiraReceita = docs[0];
  return primeiraReceita?.nome ?? '';
}

function resolveNamedValue<T extends { nome: string }>(currentValue: string, options: T[]) {
  const match = options.find(option => matchesStoredValue(currentValue, option.nome));
  return match?.nome ?? currentValue;
}

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

/** Item do menu "Relatórios" (mesmas ações dos botões da faixa antiga). */
function ItemMenu({
  icone,
  rotulo,
  descricao,
  onClick,
  disabled,
}: {
  icone: React.ReactNode;
  rotulo: string;
  descricao: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-slate-700"
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{icone}</span>
      <span className="flex flex-col gap-px">
        <span className="text-sm font-bold text-slate-900 dark:text-white">{rotulo}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{descricao}</span>
      </span>
    </button>
  );
}

/** Preferência do usuário (por navegador): totais fixados na tela. */
const TOTAIS_FIXOS_KEY = 'livro_caixa_totais_fixos';

/** Variação percentual atual x mês anterior; null quando não há base de comparação. */
function calcDelta(cur: number, prev: number | undefined): number | null {
  if (prev === undefined) return null;
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

// ─── types ───────────────────────────────────────────────────────────────────
type Row = ReciboRow;
type SortKey = 'data_lancamento' | 'valor' | 'tipo' | 'favorecido' | 'church' | 'plano_tipo';

function planoPriority(r: Row): number {
  const p = (r.plano_de_conta || r.categoria || '').toLowerCase();
  if (r.tipo === 'RECEITA') {
    if (p.includes('dizimo') || p.includes('d\u00edizimo') || p.includes('d\u00edzimo')) return 0;
    if (p.includes('oferta')) return 1;
    return 2;
  }
  return 3; // DESPESA
}
type SortDir = 'asc' | 'desc';

// ChurchOption, o histórico de últimas consultadas e o ChurchPickerModal
// moram em ./ChurchPickerModal — a tela de Blocos de Numeração usa o mesmo
// seletor, e duas cópias dariam dois históricos para o mesmo usuário.
type RegionalOption = { id: string; name: string; campoId?: string };

// ─── Pagination helper ───────────────────────────────────────────────────────
function Pagination({
  page, totalPages, total, pageSize, onPage
}: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef2f6] px-3.5 py-3 text-[13px] text-slate-500 md:px-5 dark:border-slate-800 dark:text-slate-400">
      <span>Exibindo {start}–{end} de {total} registros</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-slate-200 bg-white hover:border-slate-900 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pages.map((p, i) => p === '...'
          ? <span key={`dots-${i}`} className="px-1">…</span>
          : <button key={`page-${p}`} onClick={() => onPage(p as number)}
              className={`h-[34px] min-w-[34px] rounded-[10px] px-2 font-bold transition-all ${
                page === p
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}>
              {p}
            </button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-slate-200 bg-white hover:border-slate-900 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────
function EditDrawer({
  row, onClose, onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: (id: string, changes: Partial<Row>) => void;
}) {
  const [planos, setPlanos] = useState<{ id: string; nome: string; codigo: string | null }[]>([]);
  const [formas, setFormas] = useState<{ id: string; nome: string }[]>([]);
  const [tiposDocs, setTiposDocs] = useState<{ id: string; nome: string; sigla: string | null }[]>([]);

  const [dataLancamento, setDataLancamento] = useState(row.data_lancamento);
  const [planoDeContas, setPlanoDeContas] = useState(row.plano_de_conta || '');
  const [tipoDocumento, setTipoDocumento] = useState(row.tipo_documento || '');
  const [numDoc, setNumDoc] = useState(row.num_doc || '');
  const [formaPg, setFormaPg] = useState(row.forma_pg || '');
  const [referencia, setReferencia] = useState(row.referencia || '');
  const [obs, setObs] = useState(row.obs || '');
  const [valor, setValor] = useState(
    Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDataLancamento(row.data_lancamento);
    setPlanoDeContas(row.plano_de_conta || '');
    setTipoDocumento(row.tipo_documento || '');
    setNumDoc(row.num_doc || '');
    setFormaPg(row.forma_pg || '');
    setReferencia(row.referencia || '');
    setObs(row.obs || '');
    setValor(Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setError('');
  }, [row]);

  useEffect(() => {
    (async () => {
      const tipo = row.tipo;
      const [p, f, t] = await Promise.all([
        supabase.from('plano_de_contas').select('id, nome, codigo').eq('tipo', tipo).eq('ativo', true).order('nome'),
        supabase.from('forma_pagamento').select('id, nome').eq('mostrar', true).order('nome'),
        supabase.from('tipo_documento').select('id, nome, sigla')
          .eq(tipo === 'RECEITA' ? 'disponivel_receita' : 'disponivel_despesa', true)
          .eq('ativo', true)
          .order('nome'),
      ]);
      if (p.data) setPlanos(p.data);
      if (f.data) setFormas(f.data);
      if (t.data) setTiposDocs(filterTipoDocumentoOptions(t.data, tipo));
    })();
  }, [row.tipo]);

  useEffect(() => {
    if (planos.length > 0) {
      setPlanoDeContas(current => resolveNamedValue(current, planos));
    }
  }, [planos]);

  useEffect(() => {
    if (formas.length > 0) {
      setFormaPg(current => resolveNamedValue(current, formas));
    }
  }, [formas]);

  useEffect(() => {
    if (tiposDocs.length > 0) {
      setTipoDocumento(current => {
        const resolved = resolveTipoDocumentoValue(current, tiposDocs);
        const hasResolvedMatch = tiposDocs.some(doc => matchesStoredValue(resolved, doc.nome, doc.sigla, doc.sigla ? `${doc.sigla} - ${doc.nome}` : null));
        if (hasResolvedMatch) return resolved;
        if (row.tipo === 'RECEITA') {
          return getReceitaTipoDocumentoFallback(row.plano_de_conta || '', tiposDocs);
        }
        return resolved;
      });
      return;
    }
    if (row.tipo === 'RECEITA') {
      setTipoDocumento('');
    }
  }, [tiposDocs, row.id, row.tipo, row.tipo_documento, row.plano_de_conta]);

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setValor(''); return; }
    const num = parseInt(raw, 10) / 100;
    setValor(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  async function handleSave() {
    setError('');
    const valorNum = Number(valor.replace(/\./g, '').replace(',', '.'));
    if (!valor || isNaN(valorNum) || valorNum <= 0) { setError('Valor inválido.'); return; }

    setSaving(true);
    const { error: err } = await supabase.from('livro_caixa').update({
      data_lancamento: dataLancamento,
      plano_de_conta: planoDeContas || null,
      tipo_documento: tipoDocumento || null,
      num_doc: numDoc || null,
      forma_pg: formaPg || null,
      referencia: referencia || null,
      obs: obs || null,
      valor: valorNum,
    }).eq('id', row.id);
    setSaving(false);

    if (err) { setError('Erro ao salvar: ' + err.message); return; }

    onSaved(row.id, {
      data_lancamento: dataLancamento,
      plano_de_conta: planoDeContas || null,
      tipo_documento: tipoDocumento || null,
      num_doc: numDoc || null,
      forma_pg: formaPg || null,
      referencia: referencia || null,
      obs: obs || null,
      valor: valorNum,
    });
    onClose();
  }

  const isReceita = row.tipo === 'RECEITA';
  const accent = isReceita ? 'emerald' : 'rose';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-${accent}-50`}>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Editar Lançamento</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {row.favorecido || '—'} • <span className={`font-semibold ${isReceita ? 'text-emerald-600' : 'text-rose-600'}`}>{row.tipo}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Favorecido (read-only) */}
        <div className="px-5 pt-4 pb-2">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Favorecido / Contribuinte</p>
            <p className="text-sm font-semibold text-slate-700">{row.favorecido || '—'}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {(row.churches as any)?.name || '—'} • Doc: {row.legacy_id || row.num_doc || row.id}
            </p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Data Lançamento</label>
            <input type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Plano de Contas</label>
            <select value={planoDeContas} onChange={e => setPlanoDeContas(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">Selecione...</option>
              {planos.map(p => <option key={p.id} value={p.nome}>{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo Documento</label>
              <select value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                <option value="">Tipo...</option>
                {tiposDocs.map(t => <option key={t.id} value={t.nome}>{t.sigla ? `${t.sigla} - ` : ''}{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nº Doc</label>
              <input type="text" value={numDoc} onChange={e => setNumDoc(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Forma de Pagamento</label>
            <select value={formaPg} onChange={e => setFormaPg(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">Selecione...</option>
              {formas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Referência (Mês/Ano)</label>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="MM/AAAA"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Observações</label>
            <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Detalhes adicionais..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Valor (R$)</label>
            <input type="text" inputMode="numeric" value={valor} onChange={handleValorChange} placeholder="0,00"
              className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-violet-500 ${isReceita ? 'border-emerald-400' : 'border-rose-400'}`} />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <Permissao chave="cashbook.cashbook.salvar_edicao" rotulo="Salvar edição do lançamento — Cashbook" herda="cashbook.cashbook.editar_lancamento">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4" /> Salvar</>}
            </button>
          </Permissao>
        </div>
      </div>
    </div>
  );
}

// ─── Consultar Lançamento Modal ───────────────────────────────────────────────
function ConsultarLancamentoModal({
  onClose,
  onResults,
}: {
  onClose: () => void;
  onResults: (rows: Row[], dataInicio: string, dataFim: string) => void;
}) {
  const storedUser      = readStoredUser();
  const profileType     = (storedUser.profileType || 'church') as string;
  const isChurchProfile = profileType === 'church';

  type SearchBy = 'rol' | 'nome';

  const [searchBy, setSearchBy]     = useState<SearchBy>('nome');
  const [termo, setTermo]           = useState('');
  const [tipo, setTipo]             = useState<'all' | 'RECEITA' | 'DESPESA'>('all');
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim]       = useState(lastDayOfMonth());
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtros por regional e igreja
  const [regionais, setRegionais]                 = useState<{ id: string; name: string }[]>([]);
  const [igrejas, setIgrejas]                     = useState<{ id: string; name: string }[]>([]);
  const [selectedRegionalId, setSelectedRegionalId] = useState('');
  const [selectedChurchId, setSelectedChurchId]   = useState('');
  const [loadingRegionais, setLoadingRegionais]   = useState(false);
  const [loadingIgrejas, setLoadingIgrejas]       = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Carrega regionais ao abrir o modal (somente se não for perfil igreja)
  useEffect(() => {
    if (isChurchProfile) return;
    setLoadingRegionais(true);
    supabase
      .from('regionais')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setRegionais((data ?? []) as { id: string; name: string }[]);
        setLoadingRegionais(false);
      });
  }, [isChurchProfile]);

  // Carrega igrejas ao selecionar uma regional
  useEffect(() => {
    if (!selectedRegionalId) { setIgrejas([]); setSelectedChurchId(''); return; }
    setLoadingIgrejas(true);
    setSelectedChurchId('');
    supabase
      .from('churches')
      .select('id, name')
      .eq('regional_id', selectedRegionalId)
      .order('name')
      .then(({ data }) => {
        setIgrejas((data ?? []) as { id: string; name: string }[]);
        setLoadingIgrejas(false);
      });
  }, [selectedRegionalId]);

  const placeholders: Record<SearchBy, string> = {
    rol:  'Digite o número do ROL do membro...',
    nome: 'Digite o nome do membro ou favorecido...',
  };

  const radioLabels: { value: SearchBy; label: string }[] = [
    { value: 'rol',  label: 'ROL' },
    { value: 'nome', label: 'Nome' },
  ];

  async function handleBuscar() {
    setError('');
    if (!termo.trim() && !selectedChurchId && !selectedRegionalId) { setError('Digite um valor, selecione uma regional ou uma igreja para buscar.'); return; }
    if (dataFim < dataInicio) { setError('A data final deve ser maior ou igual à data inicial.'); return; }
    setLoading(true);
    try {
      const consultaBase = () => supabase
        .from('livro_caixa')
        .select(`id, data_lancamento, tipo, valor, favorecido, plano_de_conta,
                 categoria, forma_pg, referencia, obs, foto, legacy_id,
                 num_doc, tipo_documento, member_id, church_id, operador,
                 id_favorecido_externo, churches(name)`)
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim);

      // Os filtros são coletados antes de consultar porque a busca é paginada e
      // cada página precisa de uma query nova — um builder do supabase-js não se
      // reaproveita depois de executado. A ordem de aplicação é preservada.
      type Consulta = ReturnType<typeof consultaBase>;
      const filtros: ((q: Consulta) => Consulta)[] = [];

      if (tipo !== 'all') filtros.push(q => q.eq('tipo', tipo));

      const term = termo.trim();

      if (term) {
        if (searchBy === 'rol') {
          // ROL is stored in the members table — fetch matching member IDs first
          const rolNum = parseInt(term, 10);
          if (isNaN(rolNum)) { setLoading(false); setError('ROL deve ser um número.'); return; }
          const { data: memberData } = await supabase
            .from('members')
            .select('id, full_name')
            .eq('rol', rolNum);
          const memberIds = (memberData ?? []).map((m: { id: string }) => m.id);
          // Também casa por nome no favorecido — cobre lançamentos avulsos /
          // importados (legado) que não têm member_id vinculado, mas guardam
          // o nome do favorecido. Espelha o fallback da busca por Nome.
          const memberNames = Array.from(new Set(
            (memberData ?? [])
              .map((m: { full_name?: string | null }) => (m.full_name ?? '').trim())
              .filter(Boolean),
          ));
          if (memberIds.length === 0 && memberNames.length === 0) {
            setLoading(false);
            onResults([], dataInicio, dataFim);
            return;
          }
          const orParts: string[] = [];
          if (memberIds.length > 0) orParts.push(`member_id.in.(${memberIds.join(',')})`);
          for (const name of memberNames) orParts.push(`favorecido.ilike.%${name}%`);
          filtros.push(q => q.or(orParts.join(',')));
        } else {
          // Nome: busca membros pelo nome primeiro, filtra por member_id
          // com fallback para ilike em favorecido (não-membros / lançamentos avulsos)
          const { data: memberData } = await supabase
            .from('members')
            .select('id')
            .ilike('full_name', `%${term}%`);
          const memberIds = (memberData ?? []).map((m: { id: string }) => m.id);
          if (memberIds.length > 0) {
            const memberIdList = memberIds.join(',');
            filtros.push(q => q.or(`member_id.in.(${memberIdList}),favorecido.ilike.%${term}%`));
          } else {
            filtros.push(q => q.ilike('favorecido', `%${term}%`));
          }
        }
      }

      // Filtro por igreja específica tem maior precedência
      if (selectedChurchId) {
        filtros.push(q => q.eq('church_id', selectedChurchId));
      } else if (selectedRegionalId) {
        // Filtra por todas as igrejas da regional selecionada
        // igrejas já foi carregado pelo useEffect ao selecionar a regional
        if (igrejas.length > 0) {
          const ids = igrejas.map(c => c.id);
          filtros.push(q => q.in('church_id', ids));
        } else {
          // fallback: busca as igrejas da regional diretamente
          const { data: churchData } = await supabase
            .from('churches')
            .select('id')
            .eq('regional_id', selectedRegionalId);
          const ids = (churchData ?? []).map((c: { id: string }) => c.id);
          if (ids.length > 0) {
            filtros.push(q => q.in('church_id', ids));
          } else {
            setLoading(false);
            onResults([], dataInicio, dataFim);
            return;
          }
        }
      } else if (isChurchProfile && storedUser.churchId) {
        // Scope restriction — church profile sees only own church_id
        const churchId = storedUser.churchId;
        filtros.push(q => q.eq('church_id', churchId));
      }

      const paginaDaConsulta = (de: number, ate: number) => {
        let query = consultaBase();
        for (const filtro of filtros) query = filtro(query);
        return query
          .order('data_lancamento', { ascending: false })
          // Desempate estável entre páginas: sem ele, datas repetidas fazem uma
          // linha voltar em duas páginas e outra não voltar em nenhuma.
          .order('id', { ascending: true })
          .range(de, ate);
      };

      const { rows: achados, error: err, truncado: cortou } = await buscarTodasAsPaginas<Row>(paginaDaConsulta);
      setLoading(false);
      if (err) { setError('Erro ao consultar: ' + err); return; }
      if (cortou) {
        setError(`A consulta parou em ${MAX_LINHAS.toLocaleString('pt-BR')} lançamentos e há mais no período. Reduza o intervalo de datas ou restrinja a igreja.`);
        return;
      }
      onResults(achados, dataInicio, dataFim);
    } catch {
      setLoading(false);
      setError('Erro inesperado ao consultar.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Search className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">Consultar Lançamento</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Selecione o critério e digite para buscar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Data Inicial</label>
              <div className="relative">
                <input
                  id="modal-data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white [color-scheme:dark]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => (document.getElementById('modal-data-inicio') as HTMLInputElement)?.showPicker?.()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pointer-events-auto"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Data Final</label>
              <div className="relative">
                <input
                  id="modal-data-fim"
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white [color-scheme:dark]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => (document.getElementById('modal-data-fim') as HTMLInputElement)?.showPicker?.()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pointer-events-auto"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Tipo</label>
            <div className="flex gap-1.5">
              {([
                { v: 'all',     l: 'Todos',   a: 'bg-slate-800 border-slate-800 text-white' },
                { v: 'RECEITA', l: 'Receita', a: 'bg-emerald-500 border-emerald-500 text-white' },
                { v: 'DESPESA', l: 'Despesa', a: 'bg-rose-500 border-rose-500 text-white' },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setTipo(opt.v)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    tipo === opt.v ? opt.a : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Radio: onde buscar */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Buscar por</label>
            <div className="flex gap-2">
              {radioLabels.map(r => (
                <label key={r.value}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition-colors select-none ${
                    searchBy === r.value
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                  <input type="radio" name="searchBy" value={r.value} checked={searchBy === r.value}
                    onChange={() => { setSearchBy(r.value); setTermo(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Campo único */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={termo}
                onChange={e => setTermo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleBuscar(); }}
                placeholder={placeholders[searchBy]}
                className="w-full h-10 pl-9 pr-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Filtros: Regional e Igreja */}
          {!isChurchProfile && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Regional</label>
                <select
                  value={selectedRegionalId}
                  onChange={e => setSelectedRegionalId(e.target.value)}
                  disabled={loadingRegionais}
                  className="w-full h-9 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white bg-white"
                >
                  <option value="">Todas as regionais</option>
                  {regionais.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              {selectedRegionalId && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Igreja</label>
                  <select
                    value={selectedChurchId}
                    onChange={e => setSelectedChurchId(e.target.value)}
                    disabled={loadingIgrejas}
                    className="w-full h-9 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white bg-white"
                  >
                    <option value="">Todas as igrejas da regional</option>
                    {igrejas.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Aviso nível Igreja */}
          {isChurchProfile && storedUser.churchName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>Restrito à sua igreja: <strong className="text-slate-700 dark:text-slate-200">{storedUser.churchName}</strong></span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onClose}
            className="flex-1 h-10 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={() => { void handleBuscar(); }} disabled={loading}
            className="flex-1 h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Buscando...</span></>
              : <><Search className="w-4 h-4" /><span>Buscar</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Cashbook ────────────────────────────────────────────────────────────
export default function Cashbook() {
  const storedUser = readStoredUser();
  const profileType: string = storedUser.profileType || 'church';
  const isChurchProfile = profileType === 'church';
  const canChooseChurch = profileType === 'master' || profileType === 'admin' || profileType === 'campo';

  const navigate = useNavigate();

  // Filters
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim]       = useState(lastDayOfMonth());
  const [selectedChurch, setSelectedChurch] = useState<ChurchOption | null>(null);
  const [churchPickerOpen, setChurchPickerOpen] = useState(false);

  // Results
  const [rows, setRows]             = useState<Row[]>([]);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [error, setError]           = useState('');
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [relatorioAutoShare, setRelatorioAutoShare] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // Interface: menu Relatórios, painel de Totais (fixável) e ⋯ do lançamento no celular.
  const [relatoriosAberto, setRelatoriosAberto] = useState(false);
  const [totaisAberto, setTotaisAberto] = useState(false);
  const [totaisFixos, setTotaisFixos] = useState(() => {
    // Sem escolha salva, os totais ficam à vista — como antes, quando os cards eram fixos.
    try { return localStorage.getItem(TOTAIS_FIXOS_KEY) !== '0'; } catch { return true; }
  });
  const [menuLinha, setMenuLinha] = useState<Row | null>(null);
  useFonteModelo();

  /**
   * Contas a pagar em aberto que vencem dentro do período consultado.
   *
   * O líquido do livro caixa é dinheiro que JÁ andou; conta a pagar em aberto é
   * compromisso que ainda não saiu. Por isso ele não entra no líquido — entra
   * ao lado, como "a pagar", e o líquido projetado (líquido − a pagar) mostra
   * o que sobraria se tudo do período fosse quitado. Quando não há nada em
   * aberto, o projetado some e nada muda na leitura dos cards.
   */
  const [aPagarAberto, setAPagarAberto] = useState(0);

  // Comparativo de dízimos: quem dizimou no mês anterior (mesmo escopo) — usado
  // para detectar membros que ainda não dizimaram no período atual.
  const [prevDizimoMembers, setPrevDizimoMembers] = useState<{ member_id: string; favorecido: string }[]>([]);
  const [prevMonthRows, setPrevMonthRows] = useState<Row[]>([]);
  const [showDizimosFaltando, setShowDizimosFaltando] = useState(false);

  // Table state
  const [filterType, setFilterType] = useState<'all' | 'RECEITA' | 'DESPESA'>('all');
  // Filtro de forma de pagamento — para conferir o Livro Caixa contra o relatório
  // contábil, que conta SOMENTE dinheiro. 'all' | 'DINHEIRO' | 'PIX'.
  const [filterPg, setFilterPg] = useState<'all' | 'DINHEIRO' | 'PIX'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey]       = useState<SortKey>('plano_tipo');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(1000);
  const [editRow, setEditRow]       = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Consulta encostou no teto de MAX_LINHAS: o que está na tela é recorte, e os
  // cards de totais somam só esse recorte. Precisa aparecer, não pode ser omitido.
  const [truncado, setTruncado]     = useState(false);

  // Auto-select church for church-profile users
  useEffect(() => {
    if (isChurchProfile && storedUser.churchId && !selectedChurch) {
      setSelectedChurch({ id: storedUser.churchId, name: storedUser.churchName || 'Minha Igreja' });
    }
  }, []);

  async function buscar() {
    setError('');
    setTruncado(false);
    if (dataFim < dataInicio) { setError('A data final deve ser maior ou igual a data inicial.'); return; }
    setLoading(true);
    setSearched(true);
    setPage(1);

    // Montada por página: cada chamada precisa de uma query nova, porque um
    // builder do supabase-js não se reaproveita depois de executado.
    const paginaDoPeriodo = (de: number, ate: number) => {
      let query = supabase
        .from('livro_caixa')
        .select(`id, data_lancamento, tipo, valor, favorecido, plano_de_conta,
                 categoria, forma_pg, referencia, obs, foto, legacy_id,
                 num_doc, tipo_documento, member_id, church_id, operador, churches(name)`)
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim)
        // Estorno de pagamento do Contas a Pagar baixa o lançamento logicamente;
        // sem este filtro ele continuaria somando nos cards depois de estornado.
        .is('deleted_at', null)
        .order('data_lancamento', { ascending: false })
        // Desempate por `id`: `data_lancamento` repete centenas de vezes no mesmo
        // dia, e ordem ambígua entre páginas repete linha numa e some com outra.
        // A tabela é reordenada no cliente, então isto serve só à paginação.
        .order('id', { ascending: true })
        .range(de, ate);

      if (selectedChurch?.id) {
        query = query.eq('church_id', selectedChurch.id);
      } else if (isChurchProfile && storedUser.churchId) {
        query = query.eq('church_id', storedUser.churchId);
      }

      return query;
    };

    const { rows: encontrados, error: err, truncado } = await buscarTodasAsPaginas<Row>(paginaDoPeriodo);
    setLoading(false);
    if (err) { setError('Erro ao buscar dados: ' + err); return; }
    setRows(encontrados);
    setTruncado(truncado);
    void fetchPrevMonth();
    void fetchAPagar();
  }

  /**
   * Saldo em aberto do Contas a Pagar com vencimento dentro do período — quanto
   * ainda falta pagar, já descontando o que foi pago parcialmente. Vem pronto
   * do endpoint de relatórios: somar parcela a parcela aqui não escala.
   */
  async function fetchAPagar() {
    // Sem igreja escolhida a consulta vale para todo o escopo do usuário — é o
    // mesmo critério do livro caixa logo acima.
    const churchId = selectedChurch?.id || (isChurchProfile ? storedUser.churchId : '');
    try {
      const token = localStorage.getItem('mrm_token');
      const qs = new URLSearchParams({
        vencimentoDe: dataInicio,
        vencimentoAte: dataFim,
        status: 'PENDENTE,PARCIAL,ATRASADO',
      });
      if (churchId) qs.set('churchId', churchId);
      const res = await fetch(`${apiBase}/contas-pagar/relatorios?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setAPagarAberto(0); return; }
      const json = await res.json();
      setAPagarAberto(Number(json?.totais?.saldo ?? 0));
    } catch {
      setAPagarAberto(0); // sem contas a pagar visível é melhor que card errado
    }
  }

  // Busca os lançamentos do mês anterior (mesmo escopo de igreja) para o
  // comparativo de dízimos e as setas de variação nos cards.
  async function fetchPrevMonth() {
    const base = new Date(dataInicio + 'T12:00:00');
    const first = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    const last = new Date(base.getFullYear(), base.getMonth(), 0);
    const f = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    const paginaDoMesAnterior = (de: number, ate: number) => {
      let q = supabase
        .from('livro_caixa')
        .select('id, data_lancamento, tipo, valor, favorecido, plano_de_conta, categoria, forma_pg, member_id, church_id, churches(name)')
        .gte('data_lancamento', f(first))
        .lte('data_lancamento', f(last))
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(de, ate);

      if (selectedChurch?.id) q = q.eq('church_id', selectedChurch.id);
      else if (isChurchProfile && storedUser.churchId) q = q.eq('church_id', storedUser.churchId);

      return q;
    };

    // O mês anterior alimenta as setas de variação e a lista de quem deixou de
    // dizimar. Truncado aqui apontava variação e ausência de dízimo falsas — a
    // "Díz. faltando" acusava quem só estava depois da milésima linha.
    const { rows: prev, error: err } = await buscarTodasAsPaginas<Row>(paginaDoMesAnterior);
    if (err) { setPrevMonthRows([]); setPrevDizimoMembers([]); return; }
    setPrevMonthRows(prev);

    // Membros distintos que dizimaram no mês anterior (com member_id).
    const seen = new Set<string>();
    const membros: { member_id: string; favorecido: string }[] = [];
    for (const r of prev) {
      if (r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo') && r.member_id && !seen.has(r.member_id)) {
        seen.add(r.member_id);
        membros.push({ member_id: r.member_id, favorecido: r.favorecido || '—' });
      }
    }
    setPrevDizimoMembers(membros);
  }

  function handleRowUpdated(id: string, changes: Partial<Row>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
    if (selectedRow?.id === id) setSelectedRow(prev => prev ? { ...prev, ...changes } : prev);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'data_lancamento' || key === 'valor' ? 'desc' : 'asc'); }
    setPage(1);
  }

  // Computed values
  // pgFiltered = base para TODOS os totais/cards: respeita o filtro de forma de
  // pagamento (Todos/Dinheiro/PIX), pra os números baterem com o relatório contábil.
  const pgFiltered = useMemo(() => {
    if (filterPg === 'all') return rows;
    return rows.filter(r => (r.forma_pg || '').trim().toUpperCase() === filterPg);
  }, [rows, filterPg]);

  const typeFiltered = useMemo(() => {
    return filterType === 'all' ? pgFiltered : pgFiltered.filter(r => r.tipo === filterType);
  }, [pgFiltered, filterType]);

  const searchFiltered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return typeFiltered;
    return typeFiltered.filter(r =>
      (r.favorecido    || '').toLowerCase().includes(q) ||
      (r.plano_de_conta|| '').toLowerCase().includes(q) ||
      (r.categoria     || '').toLowerCase().includes(q) ||
      (r.forma_pg      || '').toLowerCase().includes(q) ||
      String(r.valor   || '').includes(q)
    );
  }, [typeFiltered, tableSearch]);

  const sorted = useMemo(() => {
    return [...searchFiltered].sort((a, b) => {
      if (sortKey === 'plano_tipo') {
        const pa = planoPriority(a), pb = planoPriority(b);
        if (pa !== pb) return sortDir === 'asc' ? pa - pb : pb - pa;
        // Within same group: always most recent first
        return b.data_lancamento.localeCompare(a.data_lancamento);
      }
      let av: string | number = '', bv: string | number = '';
      if (sortKey === 'data_lancamento') { av = a.data_lancamento; bv = b.data_lancamento; }
      else if (sortKey === 'valor') { av = Number(a.valor); bv = Number(b.valor); }
      else if (sortKey === 'tipo') { av = a.tipo; bv = b.tipo; }
      else if (sortKey === 'favorecido') { av = a.favorecido || ''; bv = b.favorecido || ''; }
      else if (sortKey === 'church') { av = (a.churches as any)?.name || ''; bv = (b.churches as any)?.name || ''; }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'pt-BR') : String(bv).localeCompare(String(av), 'pt-BR');
    });
  }, [searchFiltered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = useMemo(() => {
    const s = (page - 1) * pageSize;
    return sorted.slice(s, s + pageSize);
  }, [sorted, page, pageSize]);

  // Todos os cards derivam de pgFiltered — reagem ao filtro de forma de pagamento.
  const totalReceita = pgFiltered.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDespesa = pgFiltered.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDizimos = pgFiltered.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
  const totalOfertas = pgFiltered.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);
  const qtdReceitas  = pgFiltered.filter(r => r.tipo === 'RECEITA').length;
  const qtdDespesas  = pgFiltered.filter(r => r.tipo === 'DESPESA').length;
  const qtdDizimos   = pgFiltered.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).length;
  const qtdOfertas   = pgFiltered.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).length;
  const liquido      = totalReceita - totalDespesa;
  const totalMovimentos = pgFiltered.length;
  // O que sobraria se todo o Contas a Pagar do período fosse quitado hoje.
  const liquidoProjetado = liquido - aPagarAberto;

  // Contagem por forma de pagamento — sempre sobre todos os rows, pra o switch
  // mostrar o total de cada forma independente do que estiver selecionado.
  const qtdDinheiro = rows.filter(r => (r.forma_pg || '').trim().toUpperCase() === 'DINHEIRO').length;
  const qtdPix      = rows.filter(r => (r.forma_pg || '').trim().toUpperCase() === 'PIX').length;

  // Totais do mês anterior (para as setas de variação nos cards).
  const prevTotalReceita = prevMonthRows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
  const prevTotalDespesa = prevMonthRows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
  const prevTotalDizimos = prevMonthRows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
  const prevTotalOfertas = prevMonthRows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);
  const prevLiquido      = prevTotalReceita - prevTotalDespesa;
  const prevMovimentos   = prevMonthRows.length;
  const prevQtdReceitas  = prevMonthRows.filter(r => r.tipo === 'RECEITA').length;
  const prevQtdDespesas  = prevMonthRows.filter(r => r.tipo === 'DESPESA').length;
  const prevQtdDizimos   = prevMonthRows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).length;
  const prevQtdOfertas   = prevMonthRows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).length;

  // Membros que dizimaram no mês anterior e ainda não têm dízimo no período atual.
  const dizimoMembrosFaltando = useMemo(() => {
    const atuais = new Set<string>();
    for (const r of rows) {
      if (r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo') && r.member_id) atuais.add(r.member_id);
    }
    // ordem alfabética: a lista é lida nome a nome para cobrar quem faltou,
    // e sem ordenar ela sai na ordem em que os lançamentos foram feitos
    return prevDizimoMembers
      .filter(m => !atuais.has(m.member_id))
      .sort((a, b) =>
        String(a.favorecido ?? '').localeCompare(String(b.favorecido ?? ''), 'pt-BR', {
          sensitivity: 'base',
        })
      );
  }, [rows, prevDizimoMembers]);

  const periodoLabel = (() => {
    const ini = new Date(dataInicio + 'T12:00:00');
    const fim = new Date(dataFim + 'T12:00:00');
    const ultimoDia = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate();
    const mesCheio = ini.getDate() === 1 && fim.getFullYear() === ini.getFullYear() && fim.getMonth() === ini.getMonth() && fim.getDate() === ultimoDia;
    if (mesCheio) {
      const nome = ini.toLocaleDateString('pt-BR', { month: 'long' });
      return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ini.getFullYear()}`;
    }
    return `${ini.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;
  })();

  // ── Interface (modelo "Livro Caixa v2") ─────────────────────────────────
  // Só apresentação: consulta, filtros, totais e ações são os mesmos de antes.
  const temDados = searched && !loading && rows.length > 0;
  const comPrev = prevMonthRows.length > 0;

  /** Desloca o período para o mês anterior/seguinte ao do início (mês cheio). */
  function deslocarMes(delta: number) {
    const base = new Date(dataInicio + 'T12:00:00');
    const ini = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0);
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDataInicio(f(ini));
    setDataFim(f(fim));
  }

  function alternarFixarTotais() {
    const proximo = !totaisFixos;
    setTotaisFixos(proximo);
    setTotaisAberto(false);
    try { localStorage.setItem(TOTAIS_FIXOS_KEY, proximo ? '1' : '0'); } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  const ordenavel = (col: SortKey, label: string, extra = '') => (
    <button
      type="button"
      onClick={() => handleSort(col)}
      className={`flex items-center gap-1 whitespace-nowrap text-left ${sortKey === col ? 'text-slate-900 dark:text-white' : ''} ${extra}`}
    >
      {label}
      <span className="text-[11px]">{sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  );

  const deltaBadge = (cur: number, prev: number, escuro = false) => {
    if (!comPrev) return null;
    const d = calcDelta(cur, prev);
    if (d === null) return null;
    const sobe = d >= 0;
    return (
      <span
        title="Variação em relação ao mês anterior"
        className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
          escuro ? (sobe ? 'text-[#86efac]' : 'text-[#fca5a5]') : sobe ? 'text-[#15803d]' : 'text-[#b91c1c]'
        }`}
      >
        {sobe ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(d).toFixed(0)}%
      </span>
    );
  };

  const somaRD = (totalReceita + totalDespesa) || 1;

  const cardTotais = (props: { titulo: string; valor: string; sub: React.ReactNode; icone: React.ReactNode; tom: string; onClick?: () => void; delta?: React.ReactNode; alerta?: boolean }) => {
    const conteudo = (
      <>
        <span className="flex items-center gap-2.5">
          <span className={`grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] ${props.tom}`}>{props.icone}</span>
          <span className="min-w-0 truncate text-[13px] font-bold text-slate-600 dark:text-slate-300">{props.titulo}</span>
          {props.delta ? <span className="ml-auto flex-none">{props.delta}</span> : null}
        </span>
        <span className="max-w-full truncate text-[22px] font-extrabold leading-[1.1] tracking-[-.02em]">{props.valor}</span>
        <span className={`text-xs font-semibold leading-snug ${props.alerta ? 'text-[#b45309]' : 'text-slate-500 dark:text-slate-400'}`}>{props.sub}</span>
      </>
    );
    const classe = `flex min-w-0 flex-col gap-2.5 rounded-[18px] border-[1.5px] bg-white p-4 text-left dark:bg-slate-800 ${
      props.alerta ? 'border-[#fde68a]' : 'border-[#e8ecf1] dark:border-slate-700'
    }`;
    return props.onClick ? (
      <button type="button" onClick={props.onClick} className={`${classe} transition-colors hover:border-slate-900 dark:hover:border-slate-300`}>{conteudo}</button>
    ) : (
      <div className={classe}>{conteudo}</div>
    );
  };

  const chipTotal = (props: { rotulo: string; valor: string; icone: React.ReactNode; tom: string; corValor?: string; escuro?: boolean; ativo?: boolean; onClick?: () => void }) => {
    const conteudo = (
      <>
        <span className={`grid h-8 w-8 flex-none place-items-center rounded-[10px] ${props.tom}`}>{props.icone}</span>
        <span className="flex flex-col">
          <span className={`whitespace-nowrap text-[11px] font-semibold ${props.escuro ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{props.rotulo}</span>
          <span className={`whitespace-nowrap text-[15px] font-extrabold tracking-[-.01em] ${props.corValor ?? (props.escuro ? 'text-white' : '')}`}>{props.valor}</span>
        </span>
      </>
    );
    const classe = `flex flex-[1_0_auto] items-center gap-2.5 rounded-[14px] border-[1.5px] py-[7px] pl-[7px] pr-3.5 text-left ${
      props.escuro
        ? 'border-slate-900 bg-slate-900 dark:border-slate-700 dark:bg-slate-950'
        : `${props.ativo ? 'border-slate-900 dark:border-slate-300' : 'border-[#e8ecf1] dark:border-slate-700'} bg-white dark:bg-slate-800`
    }`;
    return props.onClick ? (
      <button type="button" onClick={props.onClick} className={`${classe} transition-colors hover:border-slate-900 dark:hover:border-slate-300`}>{conteudo}</button>
    ) : (
      <div className={classe}>{conteudo}</div>
    );
  };

  const filtrarTipo = (tipo: 'all' | 'RECEITA' | 'DESPESA') => { setFilterType(tipo); setPage(1); setTableSearch(''); };

  return (
    <div className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
      <style>{'@keyframes lcSlide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes lcPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'}</style>

      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-800 dark:text-slate-200">
            <Wallet className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">Financeiro</span>
            <span className="whitespace-nowrap text-[17px] font-bold">Livro Caixa</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app-ui/finance/expense/new"
            title="Nova despesa"
            className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] bg-[#fee2e2] px-[11px] text-sm font-bold text-[#b91c1c] hover:bg-[#fecaca] md:px-3.5"
          >
            <ArrowDownLeft className="h-4 w-4" strokeWidth={2.4} />
            <span className="hidden md:inline">Nova despesa</span>
          </Link>
          <Link
            to="/app-ui/finance/income/new"
            title="Nova receita"
            className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] bg-[#15803d] px-[11px] text-sm font-bold text-white hover:bg-[#166534] md:px-3.5"
          >
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
            <span className="hidden md:inline">Nova receita</span>
          </Link>
        </div>
      </header>

      <div className="box-border flex w-full flex-1 flex-col gap-2.5 px-2.5 pb-8 pt-2.5 md:px-7 md:pt-3.5">
        {/* Igreja, período e ações */}
        <div className="relative flex flex-wrap items-stretch gap-2">
          {canChooseChurch ? (
            <button
              type="button"
              onClick={() => setChurchPickerOpen(true)}
              className="relative flex h-12 min-w-[220px] flex-1 items-center gap-2.5 rounded-[14px] border-[1.5px] border-slate-200 bg-white pl-3.5 pr-3 text-left text-sm font-semibold hover:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-300"
            >
              <Church className="h-[18px] w-[18px] flex-none text-slate-500" strokeWidth={1.8} />
              <span className={`flex-1 truncate ${selectedChurch ? '' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                {selectedChurch ? selectedChurch.name : 'Todas as igrejas · escolher'}
              </span>
              {selectedChurch ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Tirar igreja escolhida"
                  onClick={e => { e.stopPropagation(); setSelectedChurch(null); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedChurch(null);
                    }
                  }}
                  className="grid h-7 w-7 flex-none place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </span>
              ) : (
                <ChevronDown className="h-4 w-4 flex-none text-slate-500" />
              )}
            </button>
          ) : null}

          {isChurchProfile && selectedChurch ? (
            <div className="flex h-12 min-w-[220px] flex-1 items-center gap-2.5 rounded-[14px] border-[1.5px] border-slate-200 bg-white pl-3.5 pr-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900">
              <Church className="h-[18px] w-[18px] flex-none text-slate-500" strokeWidth={1.8} />
              <span className="truncate">{selectedChurch.name}</span>
            </div>
          ) : null}

          <div className="flex w-full min-w-0 items-center gap-0.5 rounded-[14px] md:w-[340px] md:flex-none border-[1.5px] border-slate-200 bg-white p-[3px] dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => deslocarMes(-1)}
              title="Mês anterior"
              className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </button>
            <DateRangePicker
              from={dataInicio}
              to={dataFim}
              onChangeFrom={setDataInicio}
              onChangeTo={setDataFim}
              className="min-w-0 flex-1"
              triggerClassName="flex h-[38px] w-full min-w-0 items-center justify-center gap-1.5 rounded-[11px] px-2 text-center text-[13px] font-bold text-slate-900 outline-none hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800 [&>svg]:hidden"
            />
            <button
              type="button"
              onClick={() => deslocarMes(1)}
              title="Próximo mês"
              className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </button>
          </div>

          <div className="ml-auto flex flex-none gap-2">
            {/* Ordem: Consultar, Relatórios, Buscar lançamento, Totais, Gráficos. */}
            <button
              type="button"
              onClick={() => { void buscar(); }}
              disabled={loading}
              title="Consultar lançamentos por igreja e período"
              className="flex h-12 items-center gap-2 rounded-[14px] bg-slate-900 px-3.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 md:px-4 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              <span className="hidden md:inline">{loading ? 'Consultando...' : 'Consultar'}</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setRelatoriosAberto(aberto => !aberto)}
                title="Relatórios"
                className="flex h-12 items-center gap-2 whitespace-nowrap rounded-[14px] bg-slate-900 px-3.5 text-sm font-bold text-white hover:bg-slate-800 md:px-4 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Printer className="h-4 w-4" strokeWidth={2} />
                <span className="hidden md:inline">Relatórios</span>
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              {relatoriosAberto && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setRelatoriosAberto(false)} />
                  <div className="absolute right-0 top-[56px] z-40 flex w-[260px] animate-[lcPop_.18s_ease] flex-col gap-0.5 rounded-[18px] border border-[#e8ecf1] bg-white p-2 shadow-[0_20px_40px_-16px_rgba(15,23,42,.25)] dark:border-slate-700 dark:bg-slate-800">
                    <ItemMenu
                      icone={<Printer className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                      rotulo="Imprimir"
                      descricao={searched && rows.length > 0 ? 'Relatório do período consultado' : 'Consulte o caixa primeiro'}
                      disabled={!searched || rows.length === 0}
                      onClick={() => { setRelatoriosAberto(false); setRelatorioAutoShare(false); setShowRelatorio(true); }}
                    />
                    <ItemMenu
                      icone={<Share2 className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                      rotulo="Compartilhar"
                      descricao={searched && rows.length > 0 ? 'Enviar o relatório do período' : 'Consulte o caixa primeiro'}
                      disabled={!searched || rows.length === 0}
                      onClick={() => { setRelatoriosAberto(false); setRelatorioAutoShare(true); setShowRelatorio(true); }}
                    />
                    <ItemMenu
                      icone={<FileSpreadsheet className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                      rotulo="Exportar"
                      descricao={searched && sorted.length > 0 ? 'Planilha Excel (.xlsx) da lista' : 'Consulte o caixa primeiro'}
                      disabled={!searched || sorted.length === 0}
                      onClick={() => { setRelatoriosAberto(false); exportToExcel(sorted, dataInicio, dataFim); }}
                    />
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              title="Consultar lançamento por categoria, nome, ROL ou igreja"
              className="flex h-12 items-center gap-2 rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-sm font-semibold hover:border-slate-900 md:px-4 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-300"
            >
              <Filter className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="hidden min-[1800px]:inline">Buscar lançamento</span>
            </button>
            <button
              type="button"
              onClick={() => setTotaisAberto(aberto => !aberto)}
              title="Totais"
              disabled={!searched}
              className={`flex h-12 items-center gap-2 rounded-[14px] border-[1.5px] px-3.5 text-sm font-semibold disabled:opacity-50 md:px-4 ${
                totaisAberto || totaisFixos
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
              }`}
            >
              <Percent className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="hidden md:inline">Totais</span>
              {searched && (
                <span
                  className={`hidden font-extrabold md:inline ${
                    totaisAberto || totaisFixos
                      ? liquido >= 0 ? 'text-[#86efac] dark:text-[#15803d]' : 'text-[#fca5a5] dark:text-[#b91c1c]'
                      : liquido >= 0 ? 'text-[#15803d]' : 'text-[#b91c1c]'
                  }`}
                >
                  R$ {fmt(liquido)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAnalyticsModal(true)}
              disabled={!searched || rows.length === 0}
              title="Visualizar gráficos analíticos"
              className="flex h-12 items-center gap-2 rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-sm font-semibold hover:border-slate-900 disabled:opacity-50 md:px-4 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-300"
            >
              <BarChart3 className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="hidden md:inline">Gráficos</span>
            </button>
          </div>

          {/* Painel de totais (botão "Totais") */}
          {totaisAberto && searched && (
            <>
              <div className="fixed inset-0 z-[14]" onClick={() => setTotaisAberto(false)} />
              <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[15] flex animate-[lcSlide_.2s_ease] flex-col gap-3.5 rounded-2xl border border-[#e8ecf1] bg-white p-3 shadow-[0_28px_60px_-24px_rgba(15,23,42,.35)] md:rounded-[20px] md:p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">Totais · {periodoLabel}</span>
                  <button
                    type="button"
                    onClick={alternarFixarTotais}
                    title={totaisFixos ? 'Desafixar' : 'Deixar visível'}
                    className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] px-3 text-[13px] font-semibold ${
                      totaisFixos ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <Pin className="h-[15px] w-[15px]" strokeWidth={2} />
                    <span className="hidden md:inline">{totaisFixos ? 'Desafixar' : 'Deixar visível'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTotaisAberto(false)}
                    aria-label="Fechar"
                    className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 2xl:grid-cols-[minmax(300px,1.6fr)_repeat(5,minmax(0,1fr))]">
                  <div className="col-span-2 flex min-w-0 flex-col gap-3.5 rounded-[18px] bg-slate-900 px-[22px] py-5 text-white lg:col-span-3 2xl:col-span-1 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-[13px] font-semibold text-slate-300">Líquido do período</span>
                      <span className="flex items-center gap-2">
                        {deltaBadge(liquido, prevLiquido, true)}
                        <span className={`flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${liquido >= 0 ? 'bg-[#22c55e]/20 text-[#86efac]' : 'bg-[#f87171]/20 text-[#fca5a5]'}`}>
                          {liquido >= 0 ? 'Positivo' : 'Negativo'}
                        </span>
                      </span>
                    </div>
                    <span className="text-[30px] font-extrabold leading-none tracking-[-.03em] md:text-[38px]">R$ {fmt(liquido)}</span>
                    <div className="flex h-2 gap-[3px] overflow-hidden rounded-full bg-slate-800">
                      <span className="rounded-full bg-[#22c55e]" style={{ width: `${(totalReceita / somaRD) * 100}%` }} />
                      <span className="rounded-full bg-[#f87171]" style={{ width: `${(totalDespesa / somaRD) * 100}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-[18px] text-[13px]">
                      <span className="flex items-center gap-2 text-slate-200"><span className="h-2 w-2 rounded-full bg-[#22c55e]" />Receitas <b className="text-white">R$ {fmt(totalReceita)}</b></span>
                      <span className="flex items-center gap-2 text-slate-200"><span className="h-2 w-2 rounded-full bg-[#f87171]" />Despesas <b className="text-white">R$ {fmt(totalDespesa)}</b></span>
                    </div>
                  </div>
                  {cardTotais({
                    titulo: 'Dízimos',
                    valor: `R$ ${fmt(totalDizimos)}`,
                    sub: `${qtdDizimos} lançamento${qtdDizimos === 1 ? '' : 's'}`,
                    icone: <Heart className="h-[17px] w-[17px]" strokeWidth={1.9} />,
                    tom: 'bg-[#dcfce7] text-[#15803d]',
                    delta: deltaBadge(totalDizimos, prevTotalDizimos),
                  })}
                  {cardTotais({
                    titulo: 'Ofertas',
                    valor: `R$ ${fmt(totalOfertas)}`,
                    sub: `${qtdOfertas} lançamento${qtdOfertas === 1 ? '' : 's'}`,
                    icone: <Gift className="h-[17px] w-[17px]" strokeWidth={1.9} />,
                    tom: 'bg-[#e0f2fe] text-[#075985]',
                    delta: deltaBadge(totalOfertas, prevTotalOfertas),
                  })}
                  {cardTotais({
                    titulo: 'A pagar',
                    valor: `R$ ${fmt(aPagarAberto)}`,
                    sub: aPagarAberto > 0 ? `Líquido projetado R$ ${fmt(liquidoProjetado)}` : 'Nada em aberto no período',
                    icone: <Clock className="h-[17px] w-[17px]" strokeWidth={1.9} />,
                    tom: 'bg-[#fef3c7] text-[#b45309]',
                    alerta: aPagarAberto > 0,
                    onClick: () => navigate('/app-ui/finance/contas-a-pagar'),
                  })}
                  {cardTotais({
                    titulo: 'Movimentações',
                    valor: String(totalMovimentos),
                    sub: `${qtdReceitas} receita${qtdReceitas === 1 ? '' : 's'} · ${qtdDespesas} despesa${qtdDespesas === 1 ? '' : 's'}`,
                    icone: <Activity className="h-[17px] w-[17px]" strokeWidth={1.9} />,
                    tom: 'bg-[#f1f5f9] text-[#334155]',
                    delta: deltaBadge(totalMovimentos, prevMovimentos),
                  })}
                  {cardTotais({
                    titulo: 'Dízimos faltando',
                    valor: String(dizimoMembrosFaltando.length),
                    sub: 'Dizimaram no mês anterior e ainda não neste · ver lista',
                    icone: <UserX className="h-[17px] w-[17px]" strokeWidth={1.9} />,
                    tom: 'bg-[#f1f5f9] text-[#334155]',
                    alerta: dizimoMembrosFaltando.length > 0,
                    onClick: () => { setTotaisAberto(false); setShowDizimosFaltando(true); },
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Totais fixados na tela */}
        {totaisFixos && searched && !loading && (
          <div className="flex flex-none animate-[lcSlide_.2s_ease] gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible md:pb-0">
            {chipTotal({
              rotulo: 'Líquido',
              valor: `R$ ${fmt(liquido)}`,
              icone: <Wallet className="h-4 w-4 text-white" strokeWidth={2} />,
              tom: liquido >= 0 ? 'bg-[#166534]' : 'bg-[#991b1b]',
              corValor: liquido >= 0 ? 'text-[#86efac]' : 'text-[#fca5a5]',
              escuro: true,
              onClick: () => filtrarTipo('all'),
            })}
            {chipTotal({
              rotulo: `Receitas · ${qtdReceitas}`,
              valor: `R$ ${fmt(totalReceita)}`,
              icone: <ArrowUpRight className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#dcfce7] text-[#15803d]',
              corValor: 'text-[#15803d]',
              ativo: filterType === 'RECEITA',
              onClick: () => filtrarTipo('RECEITA'),
            })}
            {chipTotal({
              rotulo: `Despesas · ${qtdDespesas}`,
              valor: `R$ ${fmt(totalDespesa)}`,
              icone: <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#fee2e2] text-[#b91c1c]',
              corValor: 'text-[#b91c1c]',
              ativo: filterType === 'DESPESA',
              onClick: () => filtrarTipo('DESPESA'),
            })}
            {chipTotal({
              rotulo: `Dízimos · ${qtdDizimos}`,
              valor: `R$ ${fmt(totalDizimos)}`,
              icone: <Heart className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#dcfce7] text-[#15803d]',
            })}
            {chipTotal({
              rotulo: `Ofertas · ${qtdOfertas}`,
              valor: `R$ ${fmt(totalOfertas)}`,
              icone: <Gift className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#e0f2fe] text-[#075985]',
            })}
            {chipTotal({
              rotulo: 'A pagar',
              valor: `R$ ${fmt(aPagarAberto)}`,
              icone: <Clock className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#fef3c7] text-[#b45309]',
              corValor: aPagarAberto > 0 ? 'text-[#b45309]' : undefined,
              onClick: () => navigate('/app-ui/finance/contas-a-pagar'),
            })}
            {aPagarAberto > 0 && chipTotal({
              rotulo: 'Líquido projetado',
              valor: `R$ ${fmt(liquidoProjetado)}`,
              icone: <Wallet className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#f1f5f9] text-[#334155]',
              corValor: liquidoProjetado >= 0 ? 'text-[#15803d]' : 'text-[#b91c1c]',
            })}
            {chipTotal({
              rotulo: 'Movimentações',
              valor: String(totalMovimentos),
              icone: <Activity className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#f1f5f9] text-[#334155]',
            })}
            {chipTotal({
              rotulo: 'Dízimos faltando',
              valor: `${dizimoMembrosFaltando.length} membro${dizimoMembrosFaltando.length === 1 ? '' : 's'}`,
              icone: <UserX className="h-4 w-4" strokeWidth={2} />,
              tom: 'bg-[#f1f5f9] text-[#334155]',
              corValor: dizimoMembrosFaltando.length > 0 ? 'text-[#b45309]' : undefined,
              onClick: () => setShowDizimosFaltando(true),
            })}
            <button
              type="button"
              onClick={alternarFixarTotais}
              title="Desafixar totais"
              className="grid w-11 flex-none place-items-center rounded-[14px] border-[1.5px] border-dashed border-slate-300 text-slate-500 hover:border-slate-900 hover:text-slate-900 dark:border-slate-600 dark:hover:border-slate-300 dark:hover:text-white"
            >
              <PinOff className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {truncado ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Período muito amplo: a consulta parou em {MAX_LINHAS.toLocaleString('pt-BR')} lançamentos
              e <strong>há mais no período</strong>. Os totais somam apenas o que foi carregado —
              reduza o intervalo de datas ou escolha uma igreja para fechar os números.
            </span>
          </div>
        ) : null}

        {!searched && (
          <section className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-2xl border border-[#e8ecf1] bg-white px-6 py-16 text-center md:rounded-[20px] dark:border-slate-800 dark:bg-slate-900">
            <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-slate-900 text-white shadow-[0_14px_30px_-14px_rgba(15,23,42,.6)] dark:bg-white dark:text-slate-900">
              <Wallet className="h-9 w-9" strokeWidth={1.7} />
            </div>
            <h2 className="m-0 mt-1.5 text-2xl font-extrabold tracking-[-.02em]">Escolha a igreja e o período</h2>
            <p className="m-0 max-w-[440px] text-[15px] text-slate-500 dark:text-slate-400">
              Depois toque em Consultar para carregar o caixa de {new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}.
            </p>
          </section>
        )}

        {loading && (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[#e8ecf1] bg-white p-16 text-center md:rounded-[20px] dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Consultando lançamentos...</p>
          </section>
        )}

        {searched && !loading && rows.length === 0 && (
          <section className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#e8ecf1] bg-white px-6 py-14 text-center md:rounded-[20px] dark:border-slate-800 dark:bg-slate-900">
            <span className="text-base font-bold">Nenhum lançamento no período</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Mude a igreja ou o período, ou registre uma nova receita ou despesa.</span>
          </section>
        )}

        {/* ── Lista ── */}
        {temDados && (
          <section className="@container flex flex-col overflow-hidden rounded-2xl border border-[#e8ecf1] bg-white md:rounded-[20px] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-[#eef2f6] px-3.5 py-3 md:px-5 dark:border-slate-800">
              <div className="relative min-w-0 flex-[1_1_240px] md:max-w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
                <input
                  value={tableSearch}
                  onChange={e => { setTableSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar favorecido, categoria, plano, forma de pgto…"
                  className="h-9 w-full rounded-xl border-[1.5px] border-slate-200 bg-white pl-9 pr-8 text-[13px] outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-300"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => { setTableSearch(''); setPage(1); }}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex max-w-full flex-none gap-1.5 overflow-x-auto">
                {([
                  { v: 'all', rotulo: 'Todos', n: rows.length, ponto: '' },
                  { v: 'RECEITA', rotulo: 'Receitas', n: qtdReceitas, ponto: 'bg-[#16a34a]' },
                  { v: 'DESPESA', rotulo: 'Despesas', n: qtdDespesas, ponto: 'bg-[#dc2626]' },
                ] as const).map(aba => (
                  <button
                    key={aba.v}
                    type="button"
                    onClick={() => filtrarTipo(aba.v)}
                    className={`flex h-[34px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[13px] font-bold ${
                      filterType === aba.v
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {aba.ponto ? <span className={`h-[7px] w-[7px] rounded-full ${aba.ponto}`} /> : null}
                    {aba.rotulo}
                    <span className="font-semibold opacity-70">{aba.n}</span>
                    {aba.v === 'DESPESA' && totalReceita > 0 && (
                      <span title="Despesas sobre receitas" className={`rounded px-1 text-[10px] font-bold ${filterType === 'DESPESA' ? 'bg-white/20' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                        {((totalDespesa / totalReceita) * 100).toFixed(1)}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <span className="hidden h-[22px] w-px bg-slate-200 md:block dark:bg-slate-700" />
              {/* Forma de pagamento — para conferir com o relatório contábil, que conta só dinheiro. */}
              <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-[3px] dark:bg-slate-800">
                {([
                  { v: 'all', rotulo: 'Todos', n: null },
                  { v: 'DINHEIRO', rotulo: 'Dinheiro', n: qtdDinheiro },
                  { v: 'PIX', rotulo: 'PIX', n: qtdPix },
                ] as const).map(opcao => (
                  <button
                    key={opcao.v}
                    type="button"
                    onClick={() => { setFilterPg(opcao.v); setPage(1); }}
                    className={`h-7 flex-none whitespace-nowrap rounded-[9px] px-2.5 text-xs font-semibold ${
                      filterPg === opcao.v
                        ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,.12)] dark:bg-slate-950 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {opcao.rotulo}{opcao.n !== null ? <span className="ml-1 opacity-60">{opcao.n}</span> : null}
                  </button>
                ))}
              </div>
              <span className="flex-1" />
              <div className="hidden items-center gap-2 whitespace-nowrap text-[13px] text-slate-500 md:flex dark:text-slate-400">
                Exibir
                <span className="relative">
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="h-[34px] appearance-none rounded-[10px] border border-slate-200 bg-white pl-2.5 pr-7 text-[13px] font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {[1000, 2000, 3000, 4000, 5000].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                </span>
                por página
                <span className="ml-1 text-slate-400">{sorted.length} lançamento{sorted.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <Pagination page={page} totalPages={totalPages} total={sorted.length} pageSize={pageSize} onPage={setPage} />

            {/* Cabeçalho (some no celular, onde cada lançamento vira um cartão) */}
            <div className="hidden items-center gap-3.5 border-b border-[#eef2f6] bg-slate-50 px-5 py-[11px] text-xs font-bold tracking-[.03em] text-slate-500 @3xl:grid @3xl:grid-cols-[96px_minmax(0,2fr)_minmax(0,1.3fr)_120px_86px_148px] @6xl:grid-cols-[104px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.3fr)_124px_92px_148px] dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              {ordenavel('data_lancamento', 'Ref / Data')}
              {ordenavel('church', 'Igreja / Caixa', 'hidden @6xl:flex')}
              {ordenavel('favorecido', 'Descrição / Favorecido')}
              <span className="whitespace-nowrap">Plano / Categoria</span>
              {ordenavel('valor', 'Valor', 'justify-end')}
              {ordenavel('tipo', 'Tipo')}
              <span className="text-right">Ações</span>
            </div>

            {paginated.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
                <span className="text-base font-bold">Nenhum lançamento aqui</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">Mude o filtro ou a busca.</span>
              </div>
            ) : paginated.map(row => {
              const receita = row.tipo === 'RECEITA';
              const dataBR = new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR');
              const plano = row.plano_de_conta || row.categoria || '—';
              return (
                <div
                  key={row.id}
                  className="group flex items-center gap-3 border-t border-[#f1f5f9] px-3.5 py-3 first:border-t-0 hover:bg-slate-50 @3xl:grid @3xl:grid-cols-[96px_minmax(0,2fr)_minmax(0,1.3fr)_120px_86px_148px] @3xl:gap-3.5 @3xl:px-5 @6xl:grid-cols-[104px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.3fr)_124px_92px_148px] dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  {/* Celular: ícone de entrada/saída */}
                  <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl @3xl:hidden ${receita ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                    {receita ? <ArrowUpRight className="h-[17px] w-[17px]" strokeWidth={2.2} /> : <ArrowDownLeft className="h-[17px] w-[17px]" strokeWidth={2.2} />}
                  </span>

                  <span className="hidden min-w-0 flex-col gap-0.5 @3xl:flex">
                    <span className="font-mono text-[11px] font-semibold text-slate-500">{row.legacy_id ?? '—'}</span>
                    <span className="whitespace-nowrap text-[13px] font-bold">{dataBR}</span>
                    {row.num_doc && <span className="whitespace-nowrap text-[11px] text-slate-400">DOC {row.num_doc}</span>}
                  </span>

                  <span className="hidden min-w-0 flex-col gap-0.5 @6xl:flex">
                    <span className="truncate text-[13px] font-semibold">{(row.churches as any)?.name ?? '—'}</span>
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold">{row.favorecido || '—'}</span>
                    {row.obs && <span className="hidden truncate text-xs text-slate-500 @3xl:block dark:text-slate-400">{row.obs}</span>}
                    <span className="truncate text-xs text-slate-500 @3xl:hidden dark:text-slate-400">{plano} · {dataBR}</span>
                    {row.forma_pg && <span className="hidden truncate text-[11px] text-slate-400 @3xl:block">{row.forma_pg}</span>}
                  </span>

                  <span className="hidden min-w-0 flex-col gap-0.5 @3xl:flex">
                    <span className="truncate text-[13px] font-semibold">{plano}</span>
                    {row.referencia && <span className="truncate text-[11px] text-slate-400">{row.referencia}</span>}
                  </span>

                  <span className="flex flex-none justify-end">
                    <span className={`whitespace-nowrap text-sm font-extrabold ${receita ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>
                      {receita ? '+ ' : '− '}R$ {fmt(Number(row.valor))}
                    </span>
                  </span>

                  <span className="hidden @3xl:flex">
                    <span className={`flex h-6 items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] text-[11px] font-extrabold tracking-[.03em] ${receita ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {row.tipo}
                    </span>
                  </span>

                  <span className="hidden justify-end gap-0.5 @3xl:flex">
                    <Permissao chave="cashbook.cashbook.imprimir_recibo" rotulo="Imprimir recibo — Cashbook" herda="cashbook.view">
                      <button
                        type="button"
                        onClick={() => printRecibo(row, !!row.foto, row.foto)}
                        title="Imprimir recibo"
                        className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </Permissao>
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      title="Visualizar detalhes"
                      className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Eye className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <Permissao chave="cashbook.cashbook.editar_lancamento" rotulo="Editar lançamento — Cashbook" herda="cashbook.view">
                      <button
                        type="button"
                        onClick={() => setEditRow(row)}
                        title="Editar lançamento"
                        className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </Permissao>
                    <Permissao chave="cashbook.cashbook.excluir" rotulo="Excluir — Cashbook" herda="cashbook.view">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        title="Excluir"
                        className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-slate-400 hover:bg-[#fee2e2] hover:text-[#dc2626]"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </Permissao>
                  </span>

                  {/* Celular: ações no ⋯ */}
                  <button
                    type="button"
                    onClick={() => setMenuLinha(row)}
                    aria-label={`Opções do lançamento de ${row.favorecido || 'sem favorecido'}`}
                    className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 @3xl:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              );
            })}

            <Pagination page={page} totalPages={totalPages} total={sorted.length} pageSize={pageSize} onPage={setPage} />
            <div className="flex items-center justify-between gap-3 border-t border-[#eef2f6] px-3.5 py-3 text-[13px] text-slate-500 md:px-5 dark:border-slate-800 dark:text-slate-400">
              <span>{sorted.length} lançamento{sorted.length !== 1 ? 's' : ''}{tableSearch ? ' na busca' : ''}</span>
              <span className="md:hidden">
                <span className="relative">
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    aria-label="Lançamentos por página"
                    className="h-[34px] appearance-none rounded-[10px] border border-slate-200 bg-white pl-2.5 pr-7 text-[13px] font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {[1000, 2000, 3000, 4000, 5000].map(n => <option key={n} value={n}>{n} por página</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                </span>
              </span>
            </div>
          </section>
        )}
      </div>

      {/* Celular: ⋯ do lançamento — mesmas ações e permissões da linha */}
      {menuLinha && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuLinha(null)} />
          <div className="relative w-full max-w-sm animate-[lcPop_.2s_ease] rounded-t-3xl bg-white p-4 pb-6 shadow-2xl sm:rounded-3xl sm:pb-4 dark:bg-slate-900">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-slate-700" />
            <div className="flex items-center gap-3 px-1">
              <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${menuLinha.tipo === 'RECEITA' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                {menuLinha.tipo === 'RECEITA' ? <ArrowUpRight className="h-5 w-5" strokeWidth={2.2} /> : <ArrowDownLeft className="h-5 w-5" strokeWidth={2.2} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-[15px] font-bold leading-tight">{menuLinha.favorecido || '—'}</span>
                <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {new Date(menuLinha.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR')} · {menuLinha.plano_de_conta || menuLinha.categoria || '—'}
                </span>
              </span>
              <span className={`flex-none whitespace-nowrap text-sm font-extrabold ${menuLinha.tipo === 'RECEITA' ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>
                R$ {fmt(Number(menuLinha.valor))}
              </span>
            </div>
            <div className="my-3 h-px bg-[#eef2f6] dark:bg-slate-800" />
            <div className="flex flex-col gap-0.5">
              <Permissao chave="cashbook.cashbook.imprimir_recibo" rotulo="Imprimir recibo — Cashbook" herda="cashbook.view">
                <button
                  type="button"
                  onClick={() => { const alvo = menuLinha; setMenuLinha(null); printRecibo(alvo, !!alvo.foto, alvo.foto); }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Printer className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                  Imprimir recibo
                </button>
              </Permissao>
              <button
                type="button"
                onClick={() => { const alvo = menuLinha; setMenuLinha(null); setSelectedRow(alvo); }}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Eye className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                Visualizar detalhes
              </button>
              <Permissao chave="cashbook.cashbook.editar_lancamento" rotulo="Editar lançamento — Cashbook" herda="cashbook.view">
                <button
                  type="button"
                  onClick={() => { const alvo = menuLinha; setMenuLinha(null); setEditRow(alvo); }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Pencil className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                  Editar lançamento
                </button>
              </Permissao>
              <Permissao chave="cashbook.cashbook.excluir" rotulo="Excluir — Cashbook" herda="cashbook.view">
                <button
                  type="button"
                  onClick={() => { const alvo = menuLinha; setMenuLinha(null); setDeleteTarget(alvo); }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-[#dc2626] hover:bg-[#fef2f2] dark:hover:bg-red-950/30"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fee2e2] text-[#dc2626]"><Trash2 className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                  Excluir
                </button>
              </Permissao>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showSearchModal && (
        <ConsultarLancamentoModal
          onClose={() => setShowSearchModal(false)}
          onResults={(result, di, df) => {
            setRows(result);
            setDataInicio(di);
            setDataFim(df);
            setSearched(true);
            setPage(1);
            setFilterType('all');
            setShowSearchModal(false);
          }}
        />
      )}

      {showRelatorio && (
        <RelatorioModal
          rows={rows}
          churchName={selectedChurch?.name || 'Todas as Igrejas'}
          churchId={selectedChurch?.id || (isChurchProfile && storedUser.churchId ? storedUser.churchId : null)}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onClose={() => setShowRelatorio(false)}
          autoShare={relatorioAutoShare}
        />
      )}

      {showAnalyticsModal && (
        <AnalyticsModal
          onClose={() => setShowAnalyticsModal(false)}
          rows={rows}
          churchId={selectedChurch?.id || (isChurchProfile && storedUser.churchId ? storedUser.churchId : null)}
          churchName={selectedChurch?.name || (isChurchProfile && storedUser.churchName ? storedUser.churchName : 'Minha Igreja')}
          dataInicio={dataInicio}
          dataFim={dataFim}
          totalReceita={totalReceita}
          totalDespesa={totalDespesa}
          liquido={liquido}
        />
      )}

      {churchPickerOpen && (
        <ChurchPickerModal
          onClose={() => setChurchPickerOpen(false)}
          onSelect={church => { setSelectedChurch(church); setChurchPickerOpen(false); }}
        />
      )}

      {showDizimosFaltando && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowDizimosFaltando(false)}>
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white dark:bg-slate-900" style={{ fontFamily: FONTE_MODELO_FAMILIA }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-[#b45309]" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Dízimos faltando</h3>
                  <p className="text-xs text-slate-500">Dizimaram no mês anterior e ainda não no período atual</p>
                </div>
              </div>
              <button onClick={() => setShowDizimosFaltando(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {dizimoMembrosFaltando.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">Todos os que dizimaram no mês anterior já dizimaram neste período. 🎉</p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dizimoMembrosFaltando.map((m, i) => (
                    <li key={m.member_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-6 text-right text-slate-400 tabular-nums">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-200">{m.favorecido}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              {dizimoMembrosFaltando.length} membro(s) · comparado com o mês anterior
            </div>
          </div>
        </div>
      )}

      {selectedRow && (
        <ReciboModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onUpdated={handleRowUpdated}
        />
      )}

      {editRow && (
        <EditDrawer
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={(id, changes) => {
            handleRowUpdated(id, changes);
            setEditRow(null);
          }}
        />
      )}

      {/* ── Modal de confirmação de exclusão ─────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!deleting) setDeleteTarget(null); }} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
            <div className="flex items-center gap-3 px-6 pt-6 pb-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">Excluir lançamento?</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            {/* Lançamento gerado por pagamento do Contas a Pagar traz a conta e
                a parcela na referência ("CP CP-2026-000001 parcela 2/4"). */}
            {String(deleteTarget.referencia || '').startsWith('CP ') && (
              <div className="px-6 pb-3">
                <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
                  Este lançamento é o pagamento de <strong>{String(deleteTarget.referencia).replace(/^CP\s/, '')}</strong>.
                  Excluir aqui <strong>estorna o pagamento</strong>: a parcela volta a ficar em aberto no Contas a Pagar
                  e o histórico do estorno fica registrado.
                </div>
              </div>
            )}
            {deleteTarget.favorecido && (
              <div className="px-6 pb-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{deleteTarget.favorecido}</span>
                  {deleteTarget.valor && <span className="ml-2 text-slate-400">R$ {Number(deleteTarget.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                </div>
              </div>
            )}
            {deleteError && (
              <p className="px-6 pb-3 text-xs text-red-500">{deleteError}</p>
            )}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <Permissao chave="cashbook.cashbook.excluir" rotulo="Excluir — Cashbook" herda="cashbook.view">
                <button
                  onClick={async () => {
                    setDeleting(true);
                    setDeleteError('');
                    try {
                      // Passa pela API: lançamento que veio do Contas a Pagar não
                      // pode ser apagado direto — vira estorno, senão a parcela
                      // ficaria quitada sem a despesa correspondente.
                      const token = localStorage.getItem('mrm_token');
                      const res = await fetch(`${apiBase}/livro-caixa/${deleteTarget.id}`, {
                        method: 'DELETE',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ motivo: 'Lançamento excluído pelo Livro Caixa' }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(json.error || 'Falha ao excluir o lançamento.');
                      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
                      setDeleteTarget(null);
                      if (json.estornado) {
                        setError(`Pagamento estornado: a parcela ${json.parcela} da conta ${json.conta} voltou a ficar em aberto no Contas a Pagar.`);
                      }
                      void fetchAPagar();
                    } catch (e) {
                      setDeleteError('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'));
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </Permissao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
