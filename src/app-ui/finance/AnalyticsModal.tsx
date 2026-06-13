import React, { useState, useEffect, useMemo } from 'react';
import {
  X, TrendingUp, TrendingDown, DollarSign, AlertCircle, Info, Lightbulb,
  CheckCircle2, ArrowUpRight, ArrowDownRight, Building2, Printer
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';

// ─── types ───────────────────────────────────────────────────────────────────
interface Row {
  id: string;
  data_lancamento: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  favorecido?: string | null;
  plano_de_conta?: string | null;
  categoria?: string | null;
  forma_pg?: string | null;
  referencia?: string | null;
  obs?: string | null;
}

interface AnalyticsModalProps {
  onClose: () => void;
  rows: Row[];
  churchId: string | null;
  churchName: string;
  dataInicio: string;
  dataFim: string;
  totalReceita: number;
  totalDespesa: number;
  liquido: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function StatCard({
  title,
  value,
  prevMonthValue,
  prevMonthPct,
  prevYearValue,
  prevYearPct,
  loading,
  tone
}: {
  title: string;
  value: number;
  prevMonthValue: number;
  prevMonthPct: number | null;
  prevYearValue: number;
  prevYearPct: number | null;
  loading: boolean;
  tone: 'positive' | 'negative' | 'neutral';
}) {
  const valueColor = tone === 'positive'
    ? '#16a34a' // Green
    : tone === 'negative'
      ? '#dc2626' // Red
      : '#8b5cf6'; // Purple

  // Helper for formatting percentage change badges
  const renderBadge = (pct: number | null, isExpense: boolean) => {
    if (pct === null) return <span className="text-slate-400">N/A</span>;
    
    // For expense: negative change is good (green), positive change is bad (red)
    // For revenue/saldo: positive change is good (green), negative change is bad (red)
    let isGood = false;
    let label = '';
    
    if (isExpense) {
      if (pct < 0) {
        isGood = true;
        label = `Reduziu ${pct.toFixed(1)}%`;
      } else if (pct > 0) {
        isGood = false;
        label = `Aumentou +${pct.toFixed(1)}%`;
      } else {
        label = 'Sem alteração';
      }
    } else {
      if (pct > 0) {
        isGood = true;
        label = `Cresceu +${pct.toFixed(1)}%`;
      } else if (pct < 0) {
        isGood = false;
        label = `Caiu ${pct.toFixed(1)}%`;
      } else {
        label = 'Sem alteração';
      }
    }
    
    const badgeBg = isGood ? '#dcfce7' : '#fee2e2'; // light green vs light red
    const badgeText = isGood ? '#15803d' : '#b91c1c'; // green-700 vs red-700
    
    return (
      <span 
        className="px-2 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-0.5 leading-none shrink-0"
        style={{ backgroundColor: badgeBg, color: badgeText }}
      >
        {isGood ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
        {label}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
        <p className="text-xl font-bold mt-1.5" style={{ color: valueColor }}>{brl(value)}</p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800/80 mt-3 pt-2.5 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center justify-between">
          <span>Mês anterior:</span>
          {loading ? (
            <span className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{brl(prevMonthValue)}</span>
              {renderBadge(prevMonthPct, title.toLowerCase().includes('despesa'))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span>Ano anterior:</span>
          {loading ? (
            <span className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{brl(prevYearValue)}</span>
              {renderBadge(prevYearPct, title.toLowerCase().includes('despesa'))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ type, title, body }: { type: 'ok' | 'warn' | 'info' | 'tip'; title: string; body: string }) {
  const map = {
    ok:   { icon: CheckCircle2, bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }, // green
    warn: { icon: AlertCircle,  bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }, // red
    info: { icon: Info,         bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }, // blue
    tip:  { icon: Lightbulb,    bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' }, // purple
  };
  const { icon: Icon, bg, border, text } = map[type];
  return (
    <div 
      className="rounded-xl border p-3 flex gap-3 shadow-sm"
      style={{ backgroundColor: bg, borderColor: border, color: text }}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold text-xs">{title}</p>
        <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed" style={{ color: text }}>{body}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg shadow-lg text-[11px] font-medium">
        <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500 dark:text-slate-400">{entry.name}</span>
            </span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
              {brl(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function AnalyticsModal({
  onClose,
  rows,
  churchId,
  churchName,
  dataInicio,
  dataFim,
  totalReceita,
  totalDespesa,
  liquido
}: AnalyticsModalProps) {
  const [prevMonthLoading, setPrevMonthLoading] = useState(true);
  const [prevYearLoading, setPrevYearLoading] = useState(true);
  const [prevMonthTotal, setPrevMonthTotal] = useState({ receita: 0, despesa: 0, liquido: 0 });
  const [prevYearTotal, setPrevYearTotal] = useState({ receita: 0, despesa: 0, liquido: 0 });

  // ── fetch comparison data ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function fetchPrevData() {
      try {
        const start = new Date(dataInicio + 'T12:00:00');
        const end = new Date(dataFim + 'T12:00:00');

        // Mês Anterior (subtraindo 1 mês)
        const prevMonthStart = new Date(start);
        prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
        const prevMonthEnd = new Date(end);
        prevMonthEnd.setMonth(prevMonthEnd.getMonth() - 1);
        const pStartStr = prevMonthStart.toISOString().split('T')[0];
        const pEndStr = prevMonthEnd.toISOString().split('T')[0];

        // Ano Anterior (subtraindo 1 ano)
        const prevYearStart = new Date(start);
        prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
        const prevYearEnd = new Date(end);
        prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);
        const yStartStr = prevYearStart.toISOString().split('T')[0];
        const yEndStr = prevYearEnd.toISOString().split('T')[0];

        // Fetch prev month
        let queryM = supabase.from('livro_caixa').select('tipo, valor').gte('data_lancamento', pStartStr).lte('data_lancamento', pEndStr);
        if (churchId) {
          queryM = queryM.eq('church_id', churchId);
        }
        const { data: dataM } = await queryM;
        if (active && dataM) {
          const rec = dataM.filter(r => r.tipo === 'RECEITA').reduce((acc, r) => acc + Number(r.valor), 0);
          const desp = dataM.filter(r => r.tipo === 'DESPESA').reduce((acc, r) => acc + Number(r.valor), 0);
          setPrevMonthTotal({ receita: rec, despesa: desp, liquido: rec - desp });
        }
        if (active) setPrevMonthLoading(false);

        // Fetch prev year
        let queryY = supabase.from('livro_caixa').select('tipo, valor').gte('data_lancamento', yStartStr).lte('data_lancamento', yEndStr);
        if (churchId) {
          queryY = queryY.eq('church_id', churchId);
        }
        const { data: dataY } = await queryY;
        if (active && dataY) {
          const rec = dataY.filter(r => r.tipo === 'RECEITA').reduce((acc, r) => acc + Number(r.valor), 0);
          const desp = dataY.filter(r => r.tipo === 'DESPESA').reduce((acc, r) => acc + Number(r.valor), 0);
          setPrevYearTotal({ receita: rec, despesa: desp, liquido: rec - desp });
        }
        if (active) setPrevYearLoading(false);
      } catch (e) {
        console.error('Error fetching prior stats:', e);
        if (active) {
          setPrevMonthLoading(false);
          setPrevYearLoading(false);
        }
      }
    }

    fetchPrevData();
    return () => { active = false; };
  }, [dataInicio, dataFim, churchId]);

  // ── calculation of percentage comparisons ──────────────────────────────
  const compMonthReceitasPct = useMemo(() => {
    if (prevMonthLoading || prevMonthTotal.receita === 0) return null;
    return ((totalReceita - prevMonthTotal.receita) / prevMonthTotal.receita) * 100;
  }, [totalReceita, prevMonthTotal, prevMonthLoading]);

  const compMonthDespesasPct = useMemo(() => {
    if (prevMonthLoading || prevMonthTotal.despesa === 0) return null;
    return ((totalDespesa - prevMonthTotal.despesa) / prevMonthTotal.despesa) * 100;
  }, [totalDespesa, prevMonthTotal, prevMonthLoading]);

  const compMonthLiquidoPct = useMemo(() => {
    if (prevMonthLoading || prevMonthTotal.liquido === 0) return null;
    return ((liquido - prevMonthTotal.liquido) / Math.abs(prevMonthTotal.liquido)) * 100;
  }, [liquido, prevMonthTotal, prevMonthLoading]);

  const compYearReceitasPct = useMemo(() => {
    if (prevYearLoading || prevYearTotal.receita === 0) return null;
    return ((totalReceita - prevYearTotal.receita) / prevYearTotal.receita) * 100;
  }, [totalReceita, prevYearTotal, prevYearLoading]);

  const compYearDespesasPct = useMemo(() => {
    if (prevYearLoading || prevYearTotal.despesa === 0) return null;
    return ((totalDespesa - prevYearTotal.despesa) / prevYearTotal.despesa) * 100;
  }, [totalDespesa, prevYearTotal, prevYearLoading]);

  const compYearLiquidoPct = useMemo(() => {
    if (prevYearLoading || prevYearTotal.liquido === 0) return null;
    return ((liquido - prevYearTotal.liquido) / Math.abs(prevYearTotal.liquido)) * 100;
  }, [liquido, prevYearTotal, prevYearLoading]);

  // ── group by categories ───────────────────────────────────────────────
  const expenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    rows.filter(r => r.tipo === 'DESPESA').forEach(r => {
      const cat = r.plano_de_conta || r.categoria || 'Outras Despesas';
      map[cat] = (map[cat] || 0) + Number(r.valor);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const revenueCategories = useMemo(() => {
    const map: Record<string, number> = {};
    rows.filter(r => r.tipo === 'RECEITA').forEach(r => {
      const cat = r.plano_de_conta || r.categoria || 'Outras Receitas';
      map[cat] = (map[cat] || 0) + Number(r.valor);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  // ── line chart timeline ───────────────────────────────────────────────
  const lineChartData = useMemo(() => {
    const diffTime = Math.abs(new Date(dataFim + 'T12:00:00').getTime() - new Date(dataInicio + 'T12:00:00').getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 45) {
      const map: Record<string, { label: string; date: string; receitas: number; despesas: number; saldo: number }> = {};
      let current = new Date(dataInicio + 'T12:00:00');
      const end = new Date(dataFim + 'T12:00:00');
      while (current <= end) {
        const key = current.toISOString().split('T')[0];
        const label = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        map[key] = { label, date: key, receitas: 0, despesas: 0, saldo: 0 };
        current.setDate(current.getDate() + 1);
      }

      rows.forEach(r => {
        const key = r.data_lancamento;
        if (map[key]) {
          if (r.tipo === 'RECEITA') map[key].receitas += Number(r.valor);
          else map[key].despesas += Number(r.valor);
        }
      });

      let cumSaldo = 0;
      return Object.values(map)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => {
          cumSaldo += (d.receitas - d.despesas);
          return { ...d, saldo: cumSaldo };
        });
    } else {
      const map: Record<string, { label: string; date: string; receitas: number; despesas: number; saldo: number }> = {};
      rows.forEach(r => {
        const [year, month] = r.data_lancamento.split('-');
        const key = `${year}-${month}`;
        const monthsFmt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const label = `${monthsFmt[Number(month) - 1]}/${year.slice(2)}`;

        if (!map[key]) {
          map[key] = { label, date: key, receitas: 0, despesas: 0, saldo: 0 };
        }
        if (r.tipo === 'RECEITA') map[key].receitas += Number(r.valor);
        else map[key].despesas += Number(r.valor);
      });

      let cumSaldo = 0;
      return Object.values(map)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => {
          cumSaldo += (d.receitas - d.despesas);
          return { ...d, saldo: cumSaldo };
        });
    }
  }, [rows, dataInicio, dataFim]);

  // ── top 5 largest expenses ────────────────────────────────────────────
  const topExpenses = useMemo(() => {
    return [...rows]
      .filter(r => r.tipo === 'DESPESA')
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5)
      .map(r => ({
        favorecido: r.favorecido || 'Destinatário não informado',
        categoria: r.plano_de_conta || r.categoria || 'Sem categoria',
        valor: Number(r.valor),
        data: new Date(r.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR'),
      }));
  }, [rows]);

  // ── evaluation scores calculation ─────────────────────────────────────
  const scores = useMemo(() => {
    // 1. Controle de Gastos (score based on operating margin)
    const ratio = totalReceita > 0 ? (totalDespesa / totalReceita) * 100 : 0;
    let expenseScore = 100;
    if (totalReceita === 0 && totalDespesa > 0) expenseScore = 0;
    else if (ratio > 50) {
      expenseScore = Math.max(0, 100 - (ratio - 50) * 2);
    }

    // 2. Crescimento Anual (revenue comparison vs prior year)
    let growthScore = 70; // default baseline
    if (!prevYearLoading && prevYearTotal.receita > 0) {
      const pct = ((totalReceita - prevYearTotal.receita) / prevYearTotal.receita) * 100;
      if (pct >= 20) growthScore = 100;
      else if (pct >= -20) growthScore = Math.max(0, 70 + pct * 1.5);
      else growthScore = Math.max(0, 40 + pct);
    }

    // 3. Eficiência de Saldo (profitability of current period)
    let efficiencyScore = 50;
    if (totalReceita > 0) {
      efficiencyScore = Math.min(100, Math.max(0, 50 + (liquido / totalReceita) * 50));
    } else if (totalDespesa > 0) {
      efficiencyScore = 0;
    }

    // 4. Fidelidade de Dízimos (tithing ratio of income)
    const totalDizimos = rows
      .filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo'))
      .reduce((acc, r) => acc + Number(r.valor), 0);
    const dizimosRatio = totalReceita > 0 ? (totalDizimos / totalReceita) * 100 : 0;
    let tithingScore = Math.min(100, (dizimosRatio / 60) * 100);

    // 5. Consistência do Fluxo (days with movements)
    const daysWithMovements = new Set(rows.map(r => r.data_lancamento)).size;
    const consistencyScore = Math.min(100, (daysWithMovements / 15) * 100);

    return {
      expenseScore: Math.round(expenseScore),
      growthScore: Math.round(growthScore),
      efficiencyScore: Math.round(efficiencyScore),
      tithingScore: Math.round(tithingScore),
      consistencyScore: Math.round(consistencyScore),
      totalDizimos,
      dizimosRatio
    };
  }, [rows, totalReceita, totalDespesa, liquido, prevYearTotal, prevYearLoading]);

  const radarData = useMemo(() => {
    return [
      { subject: 'Controle Gastos', A: scores.expenseScore, fullMark: 100 },
      { subject: 'Crescimento Anual', A: scores.growthScore, fullMark: 100 },
      { subject: 'Eficiência Saldo', A: scores.efficiencyScore, fullMark: 100 },
      { subject: 'Fidelidade Dízimos', A: scores.tithingScore, fullMark: 100 },
      { subject: 'Consistência Fluxo', A: scores.consistencyScore, fullMark: 100 }
    ];
  }, [scores]);

  // Overall Financial Health Index
  const overallHealthIndex = useMemo(() => {
    const sum = scores.expenseScore + scores.growthScore + scores.efficiencyScore + scores.tithingScore + scores.consistencyScore;
    return Math.round(sum / 5);
  }, [scores]);

  // ── dynamic insights ──────────────────────────────────────────────────
  const healthInsights = useMemo(() => {
    const list: { type: 'ok' | 'warn' | 'info' | 'tip'; title: string; body: string }[] = [];
    const ratio = totalReceita > 0 ? (totalDespesa / totalReceita) * 100 : 0;

    if (liquido > 0) {
      if (ratio < 70) {
        list.push({
          type: 'ok',
          title: 'Saldo Operacional Saudável',
          body: `A igreja está operando com superávit de ${brl(liquido)} neste mês. Despesas representam apenas ${ratio.toFixed(1)}% das receitas. Situação confortável.`,
        });
      } else {
        list.push({
          type: 'info',
          title: 'Superávit Apertado',
          body: `Saldo positivo de ${brl(liquido)}, mas as despesas consomem ${ratio.toFixed(1)}% das receitas. Pouca margem para imprevistos.`,
        });
      }
    } else if (liquido < 0) {
      list.push({
        type: 'warn',
        title: 'Déficit no Período',
        body: `As despesas superaram as receitas em ${brl(Math.abs(liquido))} neste mês. É necessário analisar os custos operacionais.`,
      });
    } else {
      list.push({
        type: 'info',
        title: 'Equilíbrio Estrito',
        body: 'Receitas e despesas estão exatamente empatadas. A igreja não gerou reservas no período analisado.',
      });
    }

    if (!prevYearLoading) {
      const yearDiff = totalReceita - prevYearTotal.receita;
      if (prevYearTotal.receita > 0) {
        const pct = (yearDiff / prevYearTotal.receita) * 100;
        if (pct > 5) {
          list.push({
            type: 'ok',
            title: `Crescimento de Receita vs Ano Anterior (${pct.toFixed(1)}%)`,
            body: `Arrecadação cresceu ${brl(yearDiff)} em relação ao mesmo período do ano passado, indicando aumento de fidelidade e crescimento da igreja.`,
          });
        } else if (pct < -5) {
          list.push({
            type: 'warn',
            title: `Redução nas Receitas vs Ano Anterior (${pct.toFixed(1)}%)`,
            body: `Houve uma queda de ${brl(Math.abs(yearDiff))} nas receitas em relação ao ano passado. Considere campanhas de conscientização sobre contribuições.`,
          });
        } else {
          list.push({
            type: 'info',
            title: 'Faturamento Estável vs Ano Anterior',
            body: `As receitas mantiveram estabilidade com variação discreta de ${pct.toFixed(1)}% em relação ao ano passado.`,
          });
        }
      }
    }

    if (expenseCategories.length > 0) {
      const mainExpense = expenseCategories[0];
      const mainExpensePct = totalDespesa > 0 ? (mainExpense.value / totalDespesa) * 100 : 0;
      if (mainExpensePct > 25) {
        list.push({
          type: 'tip',
          title: `Foco de Redução: ${mainExpense.name}`,
          body: `Esta categoria consome ${mainExpensePct.toFixed(1)}% das despesas totais (${brl(mainExpense.value)}). Avalie se existem taxas desnecessárias ou se é possível reduzir custos operacionais nela.`,
        });
      }
    }

    return list;
  }, [totalReceita, totalDespesa, liquido, prevYearTotal, prevYearLoading, expenseCategories]);

  // Helper for table badges
  const renderTableBadge = (pct: number | null, isExpense: boolean) => {
    if (pct === null) return <span className="text-slate-400 font-mono">-</span>;
    
    // For expense: negative pct is good (green), positive is bad (red)
    // For revenue/saldo: positive pct is good (green), negative is bad (red)
    let isGood = isExpense ? pct < 0 : pct > 0;
    const label = pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
    const color = isGood ? '#16a34a' : '#dc2626';
    return (
      <span className="font-bold font-mono" style={{ color }}>
        {label}
      </span>
    );
  };

  // ── colors ────────────────────────────────────────────────────────────
  const REVENUE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#06b6d4', '#a855f7'];
  const EXPENSE_COLORS = ['#f43f5e', '#ef4444', '#f97316', '#d97706', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#475569', '#3b82f6'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 md:p-6 overflow-y-auto modal-backdrop-print">
      {/* CSS print override rules */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide all page content by default using visibility */
          body {
            visibility: hidden !important;
          }
          
          /* Make only the modal backdrop and all of its descendants visible */
          .modal-backdrop-print,
          .modal-backdrop-print * {
            visibility: visible !important;
          }
          
          /* Make the backdrop element a standard block flow container */
          .modal-backdrop-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            z-index: auto !important;
          }
          
          /* Style the modal content box */
          #printable-analytics-modal {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          
          /* Remove scroll constraints on containers */
          #printable-analytics-modal .overflow-y-auto,
          #printable-analytics-modal .overflow-x-auto,
          #printable-analytics-modal .flex-1 {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
          }
          
          /* Hide interactive/control elements */
          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Group sections into printable pages */
          .print-page {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 20px !important;
            box-sizing: border-box !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          
          /* Page break behaviors for specific components */
          .bg-white, .dark\\:bg-slate-900, .border {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-color: #cbd5e1 !important;
          }
          
          /* Print-specific Grid columns styling */
          .print-grid-3 {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 15px !important;
          }
          .print-grid-radar-score {
            display: grid !important;
            grid-template-columns: 1fr 1.6fr !important;
            gap: 20px !important;
          }
          .print-grid-insights {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 15px !important;
          }
          .print-grid-stack {
            display: block !important;
          }
          .print-grid-stack > * {
            width: 100% !important;
            margin-bottom: 20px !important;
            display: block !important;
          }
          .print-grid-2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 20px !important;
          }
          
          /* Specific heights for Recharts charts in print mode */
          .print-chart-radar {
            height: 220px !important;
          }
          .print-chart-bar {
            height: 250px !important;
          }
          .print-chart-line {
            height: 250px !important;
          }
          .print-chart-pie {
            height: 150px !important;
          }
          .recharts-responsive-container {
            width: 100% !important;
            height: 100% !important;
          }
          
          /* Colors and Text settings for high quality print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body, #printable-analytics-modal {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          
          /* Color preservation overrides */
          .text-red-600, [style*="color: #dc2626"], [style*="color: rgb(220, 38, 38)"] {
            color: #dc2626 !important;
          }
          .text-green-600, [style*="color: #16a34a"], [style*="color: rgb(22, 163, 74)"] {
            color: #16a34a !important;
          }
          
          /* Background and Border colors for Insight cards in print */
          [style*="background-color: rgb(240, 253, 244)"], [style*="background-color: #f0fdf4"] {
            background-color: #f0fdf4 !important;
            color: #15803d !important;
            border-color: #bbf7d0 !important;
          }
          [style*="background-color: rgb(254, 242, 242)"], [style*="background-color: #fef2f2"] {
            background-color: #fef2f2 !important;
            color: #b91c1c !important;
            border-color: #fecaca !important;
          }
          [style*="background-color: rgb(239, 246, 255)"], [style*="background-color: #eff6ff"] {
            background-color: #eff6ff !important;
            color: #1d4ed8 !important;
            border-color: #bfdbfe !important;
          }
          [style*="background-color: rgb(245, 243, 255)"], [style*="background-color: #f5f3ff"] {
            background-color: #f5f3ff !important;
            color: #6d28d9 !important;
            border-color: #ddd6fe !important;
          }
        }
      `}} />

      <div 
        id="printable-analytics-modal"
        className="relative bg-slate-50 dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 bg-white dark:bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Análise Financeira Contábil</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                <Building2 className="w-3.5 h-3.5" /> {churchName} 
                <span className="text-slate-300 dark:text-slate-700">•</span> 
                <span>Período: {new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Relatório
            </button>
            <button 
              onClick={onClose} 
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 print-overflow-visible">
          
          {/* PAGE 1: Resumo Executivo & Avaliação Geral */}
          <div className="print-page space-y-6">
            {/* Row 1: KPI comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-grid-3">
              <StatCard
                title="Receitas totais"
                value={totalReceita}
                prevMonthValue={prevMonthTotal.receita}
                prevMonthPct={compMonthReceitasPct}
                prevYearValue={prevYearTotal.receita}
                prevYearPct={compYearReceitasPct}
                loading={prevMonthLoading || prevYearLoading}
                tone="positive"
              />
              <StatCard
                title="Despesas totais"
                value={totalDespesa}
                prevMonthValue={prevMonthTotal.despesa}
                prevMonthPct={compMonthDespesasPct}
                prevYearValue={prevYearTotal.despesa}
                prevYearPct={compYearDespesasPct}
                loading={prevMonthLoading || prevYearLoading}
                tone="negative"
              />
              <StatCard
                title="Saldo líquido"
                value={liquido}
                prevMonthValue={prevMonthTotal.liquido}
                prevMonthPct={compMonthLiquidoPct}
                prevYearValue={prevYearTotal.liquido}
                prevYearPct={compYearLiquidoPct}
                loading={prevMonthLoading || prevYearLoading}
                tone={liquido >= 0 ? 'positive' : 'negative'}
              />
            </div>

            {/* Row 2: Radar Evaluation & Scorecard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print-grid-radar-score">
              {/* Radar chart */}
              <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm min-h-[300px] flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avaliação Multidimensional</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Balanço de desempenho em 5 dimensões contábeis</p>
                </div>
                <div className="flex-1 w-full h-[190px] mt-2 flex items-center justify-center print-chart-radar">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                      <Radar name="Pontuação" dataKey="A" stroke="#8b5cf6" fill="#c084fc" fillOpacity={0.4} />
                      <Tooltip formatter={(value) => [`${value} / 100`, 'Pontuação']} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Score details */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm min-h-[300px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pontuação de Saúde Financeira</h4>
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 leading-none"
                      style={{ 
                        backgroundColor: overallHealthIndex >= 70 ? '#dcfce7' : overallHealthIndex >= 50 ? '#fef3c7' : '#fee2e2', 
                        color: overallHealthIndex >= 70 ? '#15803d' : overallHealthIndex >= 50 ? '#b45309' : '#b91c1c' 
                      }}
                    >
                      Índice Geral: {overallHealthIndex} / 100
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Detalhamento dos fatores avaliados no radar de desempenho</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3.5 mt-4 text-xs">
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300">Controle de Gastos</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Taxa de consumo operacional da receita</p>
                    </div>
                    <span className="font-bold text-sm" style={{ color: scores.expenseScore >= 70 ? '#16a34a' : scores.expenseScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                      {scores.expenseScore} / 100
                    </span>
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300">Crescimento Anual</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Evolução do faturamento contra o ano passado</p>
                    </div>
                    <span className="font-bold text-sm" style={{ color: scores.growthScore >= 70 ? '#16a34a' : scores.growthScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                      {scores.growthScore} / 100
                    </span>
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300">Eficiência de Saldo</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Proporção de sobra/superávit do faturamento</p>
                    </div>
                    <span className="font-bold text-sm" style={{ color: scores.efficiencyScore >= 70 ? '#16a34a' : scores.efficiencyScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                      {scores.efficiencyScore} / 100
                    </span>
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300">Fidelidade dos Dízimos</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Proporção de dízimos nas receitas totais ({scores.dizimosRatio.toFixed(0)}%)</p>
                    </div>
                    <span className="font-bold text-sm" style={{ color: scores.tithingScore >= 70 ? '#16a34a' : scores.tithingScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                      {scores.tithingScore} / 100
                    </span>
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 md:col-span-2 md:border-0 md:pb-0">
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-300">Consistência do Fluxo</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Distribuição temporal das movimentações ao longo do mês</p>
                    </div>
                    <span className="font-bold text-sm" style={{ color: scores.consistencyScore >= 70 ? '#16a34a' : scores.consistencyScore >= 50 ? '#f59e0b' : '#dc2626' }}>
                      {scores.consistencyScore} / 100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PAGE 2: Análise Histórica & Diagnóstico */}
          <div className="print-page space-y-6">
            {/* Row 4: Grouped Bar Chart & Comparison Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-grid-stack">
              {/* Bar Chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm min-h-[320px] flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Comparativo Geral dos Períodos</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                    Entenda a saúde financeira comparando o faturamento (verde) com os gastos (vermelho) e o saldo (azul) em cada período.
                  </p>
                </div>
                <div className="flex-1 w-full h-[230px] mt-4 print-chart-bar">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Período Atual', 'Receitas': totalReceita, 'Despesas': totalDespesa, 'Saldo Líquido': liquido },
                        { name: 'Mês Anterior', 'Receitas': prevMonthTotal.receita, 'Despesas': prevMonthTotal.despesa, 'Saldo Líquido': prevMonthTotal.liquido },
                        { name: 'Ano Anterior', 'Receitas': prevYearTotal.receita, 'Despesas': prevYearTotal.despesa, 'Saldo Líquido': prevYearTotal.liquido }
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} />
                      <Tooltip formatter={(value) => brl(Number(value))} />
                      <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="bottom" height={24} />
                      <Bar dataKey="Receitas" name="Receita" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Despesas" name="Despesa" fill="#dc2626" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Saldo Líquido" name="Saldo Líquido" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm min-h-[320px] flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tabela de Histórico e Diferenças</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Comparativo detalhado com valores absolutos e percentuais</p>
                </div>
                <div className="flex-1 mt-4 overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                        <th className="py-2.5 font-bold uppercase tracking-wider">Métrica</th>
                        <th className="py-2.5 text-right font-bold uppercase tracking-wider">Período Atual</th>
                        <th className="py-2.5 text-right font-bold uppercase tracking-wider">Mês Anterior</th>
                        <th className="py-2.5 text-center font-bold uppercase tracking-wider">Var. Mês</th>
                        <th className="py-2.5 text-right font-bold uppercase tracking-wider">Ano Anterior</th>
                        <th className="py-2.5 text-center font-bold uppercase tracking-wider">Var. Ano</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-bold">Receitas</td>
                        <td className="py-3 text-right font-semibold" style={{ color: '#16a34a' }}>{brl(totalReceita)}</td>
                        <td className="py-3 text-right text-slate-500">{brl(prevMonthTotal.receita)}</td>
                        <td className="py-3 text-center">{renderTableBadge(compMonthReceitasPct, false)}</td>
                        <td className="py-3 text-right text-slate-500">{brl(prevYearTotal.receita)}</td>
                        <td className="py-3 text-center">{renderTableBadge(compYearReceitasPct, false)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-bold">Despesas</td>
                        <td className="py-3 text-right font-semibold" style={{ color: '#dc2626' }}>{brl(totalDespesa)}</td>
                        <td className="py-3 text-right text-slate-500">{brl(prevMonthTotal.despesa)}</td>
                        <td className="py-3 text-center">{renderTableBadge(compMonthDespesasPct, true)}</td>
                        <td className="py-3 text-right text-slate-500">{brl(prevYearTotal.despesa)}</td>
                        <td className="py-3 text-center">{renderTableBadge(compYearDespesasPct, true)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-bold">Saldo Líquido</td>
                        <td className="py-3 text-right font-bold" style={{ color: liquido >= 0 ? '#16a34a' : '#dc2626' }}>{brl(liquido)}</td>
                        <td className="py-3 text-right text-slate-500">{brl(prevMonthTotal.liquido)}</td>
                        <td className="py-3 text-center">{renderTableBadge(compMonthLiquidoPct, false)}</td>
                        <td className="py-3 text-right text-slate-500">{brl(prevYearTotal.liquido)}</td>
                        <td className="py-3 text-center">{renderTableBadge(compYearLiquidoPct, false)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Row 3: Dynamic Insights & Recommendations */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Diagnóstico Contábil & Recomendações</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 print-grid-insights">
                {healthInsights.map((insight, idx) => (
                  <InsightCard key={idx} {...insight} />
                ))}
                {healthInsights.length === 0 && (
                  <div className="col-span-full py-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                    Aguardando carregamento dos comparativos...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAGE 3: Evolução de Fluxo & Divisão por Categorias */}
          <div className="print-page space-y-6">
            {/* Row 5: Daily Timeline Line Chart & Top Expenses */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print-grid-stack">
              {/* Timeline */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[300px]">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Evolução do Fluxo de Caixa (Linha com Pontos)</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Movimentações diárias e evolução do patrimônio líquido</p>
                </div>
                <div className="flex-1 w-full h-[220px] print-chart-line">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="bottom" height={24} />
                      <Line type="monotone" dataKey="receitas" name="Receita" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="despesas" name="Despesa" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="saldo" name="Saldo Acum." stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2, strokeWidth: 1 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 5 expenses */}
              <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm min-h-[300px]">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Maiores Gastos do Mês</h4>
                    <p className="text-[10px] text-slate-400 mb-4 font-medium">Lançamentos de despesas mais elevados</p>
                    {topExpenses.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400 font-medium">Nenhum gasto registrado.</div>
                    ) : (
                      <div className="space-y-3.5">
                        {topExpenses.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-0 last:pb-0">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{item.favorecido}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{item.categoria} • {item.data}</p>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-red-600 dark:text-red-400 shrink-0">{brl(item.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 6: Expenses Pizza & Revenues Rosca (Donut) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print-grid-2">
              {/* Donut: Revenues Categories */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[280px]">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Origem dos Ganhos (Receitas por Categoria)</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Distribuição das fontes de receitas e dízimos</p>
                </div>
                {revenueCategories.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-12">Nenhuma receita registrada.</div>
                ) : (
                  <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 mt-2">
                    <div className="w-[140px] h-[140px] shrink-0 print-chart-pie">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={revenueCategories}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {revenueCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={REVENUE_COLORS[index % REVENUE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => brl(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 max-h-[160px] overflow-y-auto space-y-1.5 w-full">
                      {revenueCategories.slice(0, 5).map((item, idx) => {
                        const pct = totalReceita > 0 ? (item.value / totalReceita) * 100 : 0;
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 truncate pr-2">
                              <span className="w-2.5 h-2.5 rounded-xs inline-block shrink-0" style={{ backgroundColor: REVENUE_COLORS[idx % REVENUE_COLORS.length] }} />
                              <span className="text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                            </span>
                            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold shrink-0">{pct.toFixed(0)}% ({brl(item.value)})</span>
                          </div>
                        );
                      })}
                      {revenueCategories.length > 5 && (
                        <div className="text-[10px] text-slate-400 pl-4">e outras {revenueCategories.length - 5} categorias...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pie: Expenses Categories */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[280px]">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Destinação dos Gastos (Despesas por Categoria)</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Categorias de saídas contábeis de maior impacto</p>
                </div>
                {expenseCategories.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-12 font-medium">Nenhuma despesa registrada.</div>
                ) : (
                  <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 mt-2">
                    <div className="w-[140px] h-[140px] shrink-0 print-chart-pie">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseCategories}
                            cx="50%"
                            cy="50%"
                            outerRadius={65}
                            paddingAngle={1}
                            dataKey="value"
                          >
                            {expenseCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => brl(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 max-h-[160px] overflow-y-auto space-y-1.5 w-full">
                      {expenseCategories.slice(0, 5).map((item, idx) => {
                        const pct = totalDespesa > 0 ? (item.value / totalDespesa) * 100 : 0;
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 truncate pr-2">
                              <span className="w-2.5 h-2.5 rounded-xs inline-block shrink-0" style={{ backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }} />
                              <span className="text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                            </span>
                            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold shrink-0">{pct.toFixed(0)}% ({brl(item.value)})</span>
                          </div>
                        );
                      })}
                      {expenseCategories.length > 5 && (
                        <div className="text-[10px] text-slate-400 pl-4">e outras {expenseCategories.length - 5} categorias...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800/80 px-6 py-4 bg-white dark:bg-slate-900 flex justify-end flex-shrink-0 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Fechar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
