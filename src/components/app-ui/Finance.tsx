import { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';

function firstDayOfMonth(year?: number, month?: number) {
  const d = new Date();
  const y = year ?? d.getFullYear();
  const m = month ?? d.getMonth();
  return new Date(y, m, 1).toISOString().split('T')[0];
}
function lastDayOfMonth(year?: number, month?: number) {
  const d = new Date();
  const y = year ?? d.getFullYear();
  const m = month ?? d.getMonth();
  return new Date(y, m + 1, 0).toISOString().split('T')[0];
}
function brl(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

interface Row {
  id: string;
  data_lancamento: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  favorecido: string | null;
  plano_de_conta: string | null;
  categoria: string | null;
  forma_pg: string | null;
  church_id: string;
  churches?: { name: string } | null;
}

function buildMonthOptions() {
  const opts: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    opts.push({ label: label.charAt(0).toUpperCase() + label.slice(1), year: d.getFullYear(), month: d.getMonth() });
  }
  return opts;
}

export function Finance() {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const storedUser = readStoredUser();
        const isChurchProfile = storedUser.profileType === 'church';
        const dateFrom = firstDayOfMonth(selYear, selMonth);
        const dateTo = lastDayOfMonth(selYear, selMonth);

        let query = supabase
          .from('livro_caixa')
          .select('id, data_lancamento, tipo, valor, favorecido, plano_de_conta, categoria, forma_pg, church_id, churches(name)')
          .gte('data_lancamento', dateFrom)
          .lte('data_lancamento', dateTo)
          .is('deleted_at', null)
          .order('data_lancamento', { ascending: false })
          .limit(500);

        if (isChurchProfile && storedUser.churchId) {
          query = query.eq('church_id', storedUser.churchId);
        }

        const { data, error: err } = await query;
        if (cancelled) return;
        if (err) { setError(err.message); setLoading(false); return; }
        setRows((data as unknown as Row[]) || []);
      } catch (e: unknown) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selYear, selMonth]);

  const totalReceita = useMemo(() => rows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0), [rows]);
  const totalDespesa = useMemo(() => rows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0), [rows]);
  const saldo = totalReceita - totalDespesa;

  function handleExport() {
    if (!rows.length) return;
    const data = rows.map((r, i) => ({
      '#': i + 1,
      'Data': r.data_lancamento ? new Date(r.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR') : '',
      'Tipo': r.tipo,
      'Favorecido': r.favorecido ?? '',
      'Plano de Conta': r.plano_de_conta ?? '',
      'Categoria': r.categoria ?? '',
      'Forma Pgto': r.forma_pg ?? '',
      'Valor (R$)': Number(r.valor),
      'Igreja': (r.churches as { name: string } | null)?.name ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tesouraria');
    XLSX.writeFile(wb, `tesouraria_${firstDayOfMonth(selYear, selMonth)}_${lastDayOfMonth(selYear, selMonth)}.xlsx`);
  }

  const currentMonthLabel = monthOptions.find(o => o.year === selYear && o.month === selMonth)?.label ?? '';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financeiro</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie receitas, despesas e tesouraria</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <select
            className="border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
            value={`${selYear}-${selMonth}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-');
              setSelYear(Number(y));
              setSelMonth(Number(m));
            }}
          >
            {monthOptions.map(o => (
              <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={!rows.length}
            className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <Link
            to="/app-ui/finance/new"
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Transação
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Receitas</p>
              {loading ? <div className="h-7 w-28 bg-slate-100 animate-pulse rounded mt-1" /> : (
                <p className="text-2xl font-bold text-green-600">R$ {brl(totalReceita)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Despesas</p>
              {loading ? <div className="h-7 w-28 bg-slate-100 animate-pulse rounded mt-1" /> : (
                <p className="text-2xl font-bold text-red-600">R$ {brl(totalDespesa)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Saldo</p>
              {loading ? <div className="h-7 w-28 bg-slate-100 animate-pulse rounded mt-1" /> : (
                <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  R$ {brl(saldo)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Transações</p>
              {loading ? <div className="h-7 w-16 bg-slate-100 animate-pulse rounded mt-1" /> : (
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{rows.length}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Transações — {currentMonthLabel}</h2>
              {!loading && <p className="text-sm text-slate-500 mt-0.5">{rows.length} lançamentos encontrados</p>}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Carregando...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Calendar className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">Nenhum lançamento no período selecionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição / Favorecido</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plano de Conta</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Forma Pgto</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Igreja</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map((row) => {
                  const churchName = (row.churches as { name: string } | null)?.name ?? '—';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.data_lancamento
                          ? new Date(row.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{row.favorecido || '—'}</p>
                        {row.categoria && (
                          <p className="text-xs text-slate-400 mt-0.5">{row.categoria}</p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">
                          {row.plano_de_conta || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {row.forma_pg || '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {churchName}
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <span className={`font-semibold text-sm ${row.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>
                          {row.tipo === 'RECEITA' ? '+' : '-'} R$ {brl(Number(row.valor))}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.tipo === 'RECEITA'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {row.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
