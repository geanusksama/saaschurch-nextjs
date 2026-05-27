import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet,
  Users, RefreshCw, ChevronDown, Minus, Eye, EyeOff,
  AlertTriangle, CheckCircle, Info, Lightbulb, Building2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { apiBase } from '../../lib/apiBase';

// ─── helpers ────────────────────────────────────────────────────────────────
function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}
function readToken() { return localStorage.getItem('mrm_token') || ''; }
function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}
function shortBrl(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return brl(v);
}
function fmtMes(mes: string) {
  const [y, m] = mes.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(m) - 1]}/${y.slice(2)}`;
}

// ─── linear regression ───────────────────────────────────────────────────────
function linReg(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const sx2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sx2 - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

// ─── types ───────────────────────────────────────────────────────────────────
interface Summary {
  currentYear: number; prevYear: number;
  receita: { atual: number; anterior: number; pct: number | null; mediaMensal: number };
  despesa: { atual: number; anterior: number; pct: number | null; mediaMensal: number };
  saldo: { atual: number; anterior: number };
}
interface MonthPoint { mes: string; receita: number; despesa: number; saldo: number; saldoAcumulado: number }
interface CategoryItem { categoria: string; total: number; count: number }
interface CategoryData { receitas: CategoryItem[]; despesas: CategoryItem[]; year: number }
interface PaymentItem { forma: string; total: number; count: number }
interface PaymentData { receitas: PaymentItem[]; despesas: PaymentItem[] }
interface TitherPoint { mes: string; dizimistas: number; total: number }
interface ChurchItem { churchId: string; churchName: string; receita: number; despesa: number; saldo: number; lancamentos: number }

// ─── palette ─────────────────────────────────────────────────────────────────
const GREEN = '#22c55e'; const RED = '#ef4444'; const BLUE = '#3b82f6';
const AMBER = '#f59e0b'; const PURPLE = '#8b5cf6'; const TEAL = '#14b8a6';
const PIE_COLORS = [GREEN, BLUE, AMBER, PURPLE, TEAL, '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#a855f7'];
const PIE_COLORS_RED = [RED, '#f97316', AMBER, PURPLE, '#ec4899', TEAL, '#06b6d4', '#84cc16', '#3b82f6', '#a855f7'];

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, pct, icon: Icon, color, loading }: {
  label: string; value: string; sub?: string; pct?: number | null;
  icon: React.ComponentType<{ className?: string }>; color: string; loading?: boolean;
}) {
  const positive = pct != null && pct >= 0;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      {loading ? <div className="h-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" /> : (
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      )}
      <div className="flex items-center gap-2 text-xs">
        {pct != null ? (
          <span className={`flex items-center gap-1 font-semibold ${positive ? 'text-green-600' : 'text-red-500'}`}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{pct}%
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400"><Minus className="w-3 h-3" />Sem ref. anterior</span>
        )}
        {sub && <span className="text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">{children}</h3>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BrlTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs min-w-[170px]">
      <p className="font-semibold mb-2 text-slate-700 dark:text-slate-200">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }}>{p.strokeDasharray ? '- ' : ''}{p.name}</span>
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{shortBrl(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props as {
    cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; name: string;
  };
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 22;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const t = name.length > 18 ? name.slice(0, 16) + '…' : name;
  return (
    <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
      {t} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

function InsightCard({ type, title, body }: { type: 'ok' | 'warn' | 'info' | 'tip'; title: string; body: string }) {
  const map = {
    ok:   { icon: CheckCircle,    cls: 'bg-green-50  dark:bg-green-900/20  border-green-200  dark:border-green-800  text-green-700  dark:text-green-400'  },
    warn: { icon: AlertTriangle,  cls: 'bg-amber-50  dark:bg-amber-900/20  border-amber-200  dark:border-amber-800  text-amber-700  dark:text-amber-400'  },
    info: { icon: Info,           cls: 'bg-blue-50   dark:bg-blue-900/20   border-blue-200   dark:border-blue-800   text-blue-700   dark:text-blue-400'   },
    tip:  { icon: Lightbulb,      cls: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400' },
  };
  const { icon: Icon, cls } = map[type];
  return (
    <div className={`rounded-xl border p-4 flex gap-3 ${cls}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs mt-0.5 opacity-80">{body}</p>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function FinancialReportsDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthPoint[]>([]);
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [payments, setPayments] = useState<PaymentData | null>(null);
  const [tithers, setTithers] = useState<TitherPoint[]>([]);
  const [churches, setChurches] = useState<ChurchItem[]>([]);
  const [viewMonths, setViewMonths] = useState(24);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [catTab, setCatTab] = useState<'receita' | 'despesa'>('receita');
  const [payTab, setPayTab] = useState<'receita' | 'despesa'>('receita');
  const [error, setError] = useState<string | null>(null);

  const storedUser = readStoredUser();
  const profileType: string = storedUser.profileType || '';
  const roleName: string = (storedUser.roleName || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isChurchRestricted = profileType === 'church' || roleName.includes('secret') || roleName.includes('tesour');
  const churchId = isChurchRestricted ? (storedUser.churchId || null) : null;
  const isCampoPlus = !isChurchRestricted;
  const currentYear = new Date().getFullYear();

  const post = useCallback(async (path: string, body: Record<string, unknown>) => {
    const token = readToken();
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    const base = { churchId };
    const [sumRes, monthRes, catRes, payRes, tithRes, churchRes] = await Promise.allSettled([
      post('/finance/dashboard/summary', base),
      post('/finance/dashboard/monthly-evolution', { ...base, months: viewMonths }),
      post('/finance/dashboard/category-breakdown', { ...base, year: currentYear }),
      post('/finance/dashboard/payment-methods', { ...base, year: currentYear }),
      post('/finance/dashboard/tithers-monthly', { ...base, months: viewMonths }),
      post('/finance/dashboard/church-ranking', { ...base, months: 3 }),
    ]);
    if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
    if (monthRes.status === 'fulfilled') setMonthly(monthRes.value.data ?? []);
    if (catRes.status === 'fulfilled') setCategories(catRes.value);
    if (payRes.status === 'fulfilled') setPayments(payRes.value);
    if (tithRes.status === 'fulfilled') setTithers(tithRes.value.data ?? []);
    if (churchRes.status === 'fulfilled') setChurches(churchRes.value.churches ?? []);
    const failures = [sumRes, monthRes, catRes, payRes, tithRes, churchRes]
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'Erro');
    if (failures.length) setError(failures.join(' | '));
    setLoading(false);
  }, [post, churchId, viewMonths, currentYear]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── filter empty months ──────────────────────────────────────────────────
  const activeMonthly = useMemo(() =>
    hideEmpty ? monthly.filter((m) => m.receita > 0 || m.despesa > 0) : monthly, [monthly, hideEmpty]);
  const monthlyLabeled = useMemo(() =>
    activeMonthly.map((m) => ({ ...m, label: fmtMes(m.mes) })), [activeMonthly]);

  const tithersLabeled = useMemo(() => {
    const src = hideEmpty ? tithers.filter((t) => t.dizimistas > 0 || t.total > 0) : tithers;
    return src.map((t) => ({ ...t, label: fmtMes(t.mes) }));
  }, [tithers, hideEmpty]);

  // ── forecast (linear regression on last 6 active months) ────────────────
  const forecast = useMemo(() => {
    const withData = monthly.filter((m) => m.receita > 0 || m.despesa > 0);
    if (withData.length < 2) return [];
    const last = withData.slice(-Math.min(6, withData.length));
    const recReg = linReg(last.map((m, i) => ({ x: i, y: m.receita })));
    const despReg = linReg(last.map((m, i) => ({ x: i, y: m.despesa })));
    const lastMes = withData[withData.length - 1].mes;
    const [ly, lm] = lastMes.split('-').map(Number);
    return [1, 2, 3].map((offset) => {
      const d = new Date(ly, lm - 1 + offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const xi = last.length - 1 + offset;
      return {
        mes: key, label: fmtMes(key),
        receitaProj: Math.max(0, Math.round(recReg.slope * xi + recReg.intercept)),
        despesaProj: Math.max(0, Math.round(despReg.slope * xi + despReg.intercept)),
      };
    });
  }, [monthly]);

  const evolutionData = useMemo(() => [
    ...monthlyLabeled.map((m) => ({ ...m, receitaProj: undefined as number | undefined, despesaProj: undefined as number | undefined })),
    ...forecast.map((f) => ({ ...f, receita: undefined as number | undefined, despesa: undefined as number | undefined, saldo: undefined as number | undefined, saldoAcumulado: undefined as number | undefined })),
  ], [monthlyLabeled, forecast]);

  // ── insights ─────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const result: { type: 'ok' | 'warn' | 'info' | 'tip'; title: string; body: string }[] = [];
    if (!summary) return result;
    const { receita, despesa, saldo } = summary;
    const ratio = receita.atual > 0 ? (despesa.atual / receita.atual) * 100 : 0;

    if (ratio > 90) result.push({ type: 'warn', title: 'Despesas muito altas', body: `${ratio.toFixed(0)}% da receita vai para despesas. O ideal é abaixo de 80%.` });
    else if (ratio > 70) result.push({ type: 'info', title: 'Despesas moderadas', body: `${ratio.toFixed(0)}% da receita em despesas. Margem de ${(100 - ratio).toFixed(0)}% de superávit.` });
    else if (ratio > 0) result.push({ type: 'ok', title: 'Boa margem financeira', body: `Apenas ${ratio.toFixed(0)}% da receita em despesas. Superávit saudável de ${(100 - ratio).toFixed(0)}%.` });

    if (receita.pct != null && receita.pct > 0)
      result.push({ type: 'ok', title: `Receitas cresceram ${receita.pct}% vs ${summary.prevYear}`, body: `De ${shortBrl(receita.anterior)} para ${shortBrl(receita.atual)} no ano corrente.` });
    else if (receita.pct != null && receita.pct < 0)
      result.push({ type: 'warn', title: `Receitas caíram ${Math.abs(receita.pct)}% vs ${summary.prevYear}`, body: `De ${shortBrl(receita.anterior)} para ${shortBrl(receita.atual)}. Verifique os meses de queda.` });

    if (saldo.atual < 0)
      result.push({ type: 'warn', title: 'Déficit no ano atual', body: `Gastos ${shortBrl(Math.abs(saldo.atual))} acima das receitas em ${summary.currentYear}.` });

    if (forecast.length > 0) {
      const next = forecast[0];
      const saldoProj = next.receitaProj - next.despesaProj;
      result.push({ type: 'tip', title: `Previsão ${fmtMes(next.mes)}: Receita ~${shortBrl(next.receitaProj)}`, body: `Despesa projetada ~${shortBrl(next.despesaProj)} → Saldo estimado ${saldoProj >= 0 ? '+' : ''}${shortBrl(saldoProj)}.` });
    }

    if (result.length === 0)
      result.push({ type: 'info', title: 'Dados insuficientes para análise', body: 'Registre mais lançamentos para gerar diagnósticos automáticos.' });
    return result;
  }, [summary, forecast]);

  // ── derived ───────────────────────────────────────────────────────────────
  const catData = (catTab === 'receita' ? categories?.receitas : categories?.despesas)?.slice(0, 10) ?? [];
  const payData = (payTab === 'receita' ? payments?.receitas : payments?.despesas)?.slice(0, 8) ?? [];
  const barPayData = payData.map((p) => ({ name: p.forma, valor: p.total }));
  const colors = catTab === 'receita' ? PIE_COLORS : PIE_COLORS_RED;
  const emptyCount = monthly.filter((m) => m.receita === 0 && m.despesa === 0).length;
  const xInterval = evolutionData.length <= 8 ? 0 : evolutionData.length <= 14 ? 0 : 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 space-y-6">

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios Financeiros</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Dashboard de crescimento e análise contábil</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {emptyCount > 0 && (
            <button onClick={() => setHideEmpty(!hideEmpty)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border shadow-sm transition-colors ${hideEmpty ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {hideEmpty ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {hideEmpty ? `${emptyCount} meses sem dados ocultos` : 'Mostrar todos os meses'}
            </button>
          )}
          <div className="relative">
            <select value={viewMonths} onChange={(e) => setViewMonths(Number(e.target.value))}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-8 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer">
              <option value={12}>Últimos 12 meses</option>
              <option value={24}>Últimos 24 meses</option>
              <option value={36}>Últimos 36 meses</option>
              <option value={60}>Últimos 5 anos</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <button onClick={loadAll} disabled={loading}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={`Receitas ${currentYear}`} value={summary ? shortBrl(summary.receita.atual) : '—'} sub="vs ano anterior" pct={summary?.receita.pct ?? null} icon={TrendingUp} color="bg-green-500" loading={loading} />
        <KpiCard label={`Despesas ${currentYear}`} value={summary ? shortBrl(summary.despesa.atual) : '—'} sub="vs ano anterior" pct={summary ? (summary.despesa.pct != null ? -summary.despesa.pct : null) : null} icon={TrendingDown} color="bg-red-500" loading={loading} />
        <KpiCard label="Saldo Líquido" value={summary ? shortBrl(summary.saldo.atual) : '—'} sub={summary ? (summary.saldo.atual >= 0 ? 'Superávit' : 'Déficit') : ''} pct={summary && summary.saldo.anterior !== 0 ? Math.round(((summary.saldo.atual - summary.saldo.anterior) / Math.abs(summary.saldo.anterior)) * 1000) / 10 : null} icon={Wallet} color={summary && summary.saldo.atual >= 0 ? 'bg-blue-500' : 'bg-orange-500'} loading={loading} />
        <KpiCard label="Média Mensal (Receita)" value={summary ? shortBrl(summary.receita.mediaMensal) : '—'} sub="meses com lançamento" pct={null} icon={DollarSign} color="bg-purple-500" loading={loading} />
      </div>

      {/* insights */}
      {!loading && insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}

      {/* evolução + previsão */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Evolução Mensal — Receitas × Despesas × Previsão</SectionTitle>
          {forecast.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1">— — previsão 3 meses (regressão linear)</span>
          )}
        </div>
        {loading ? <div className="h-64 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={evolutionData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.18} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RED} stopOpacity={0.18} /><stop offset="95%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={xInterval} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => shortBrl(v)} width={72} />
              <Tooltip content={<BrlTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke={GREEN} fill="url(#gRec)" strokeWidth={2} dot={false} connectNulls />
              <Area type="monotone" dataKey="despesa" name="Despesa" stroke={RED} fill="url(#gDesp)" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="receitaProj" name="Receita (prev.)" stroke={GREEN} strokeDasharray="6 4" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="despesaProj" name="Despesa (prev.)" stroke={RED} strokeDasharray="6 4" strokeWidth={2} dot={false} connectNulls />
              {forecast.length > 0 && <ReferenceLine x={forecast[0].label} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'hoje →', fontSize: 9, fill: '#94a3b8' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* patrimônio acumulado */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <SectionTitle>Patrimônio Acumulado (Saldo Corrido)</SectionTitle>
        {loading ? <div className="h-48 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyLabeled} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PURPLE} stopOpacity={0.25} /><stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={xInterval} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => shortBrl(v)} width={72} />
              <Tooltip content={<BrlTooltip />} />
              <Area type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke={PURPLE} fill="url(#gAcc)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* categorias + pagamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Plano de Contas ({currentYear})</SectionTitle>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs">
              <button onClick={() => setCatTab('receita')} className={`px-3 py-1 font-medium transition-colors ${catTab === 'receita' ? 'bg-green-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Receita</button>
              <button onClick={() => setCatTab('despesa')} className={`px-3 py-1 font-medium transition-colors ${catTab === 'despesa' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Despesa</button>
            </div>
          </div>
          {loading ? <div className="h-56 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : catData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={75} labelLine={false} label={(p) => <PieLabel {...p} />}>
                  {catData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => brl(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Forma de Pagamento ({currentYear})</SectionTitle>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs">
              <button onClick={() => setPayTab('receita')} className={`px-3 py-1 font-medium transition-colors ${payTab === 'receita' ? 'bg-green-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Receita</button>
              <button onClick={() => setPayTab('despesa')} className={`px-3 py-1 font-medium transition-colors ${payTab === 'despesa' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Despesa</button>
            </div>
          </div>
          {loading ? <div className="h-56 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : barPayData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barPayData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => shortBrl(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Bar dataKey="valor" name="Total" radius={[0, 4, 4, 0]}>
                  {barPayData.map((_, i) => <Cell key={i} fill={payTab === 'receita' ? PIE_COLORS[i % PIE_COLORS.length] : PIE_COLORS_RED[i % PIE_COLORS_RED.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ranking por igreja */}
      {isCampoPlus && churches.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionTitle>Ranking por Igreja — Últimos 3 Meses</SectionTitle>
          {loading ? <div className="h-56 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={Math.max(220, churches.length * 38)}>
              <BarChart
                data={churches.map((c) => ({ name: c.churchName.length > 30 ? c.churchName.slice(0, 28) + '…' : c.churchName, receita: c.receita, despesa: c.despesa }))}
                layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => shortBrl(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={170} />
                <Tooltip content={<BrlTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill={GREEN} radius={[0, 3, 3, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill={RED} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* dizimistas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <SectionTitle>Dizimistas Ativos por Mês</SectionTitle>
        {loading ? <div className="h-52 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={tithersLabeled} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={xInterval} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => shortBrl(v)} width={72} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(v: any, name: any) => name === 'Dizimistas' ? [`${Number(v)}`, name] : [brl(Number(v)), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="dizimistas" name="Dizimistas" fill={AMBER} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="total" name="Total Dízimos" stroke={TEAL} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* receita × despesa barras mensais */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <SectionTitle>Receita × Despesa por Mês — Detalhe</SectionTitle>
        {loading ? <div className="h-56 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyLabeled} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={xInterval} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => shortBrl(v)} width={72} />
              <Tooltip content={<BrlTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill={GREEN} radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill={RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* aviso meses vazios */}
      {emptyCount > viewMonths / 2 && (
        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span><strong>{emptyCount} dos {viewMonths} meses</strong> não possuem lançamentos — o sistema foi adotado recentemente. À medida que mais dados forem registrados, as previsões e comparativos ficarão mais precisos.</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 pb-6 flex-wrap">
        <BarChart3 className="w-3 h-3" />
        <span>Dados calculados sobre o Livro Caixa. Previsão por regressão linear simples nos últimos 6 meses com dados.</span>
        {isCampoPlus && <><Building2 className="w-3 h-3 ml-2" /><span>Visão de campo — todas as igrejas vinculadas.</span></>}
        <Users className="w-3 h-3 ml-2" />
        <span>Dizimistas = contribuidores únicos por mês com plano de conta "Dízimo".</span>
      </div>
    </div>
  );
}
