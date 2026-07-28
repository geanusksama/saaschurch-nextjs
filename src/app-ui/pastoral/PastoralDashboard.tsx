/**
 * Dashboard da Gestão Pastoral — Pipeline + Cronograma numa tela só.
 *
 * Gráficos em SVG/CSS puro, sem lib de chart: a página já é pesada e barras
 * e donuts simples dão conta do que precisa ser lido de relance.
 * Exporta em CSV/Excel e imprime com os blocos agrupados.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, Loader2, RefreshCw, Download, FileSpreadsheet, Printer,
  AlertTriangle, Flame, Award, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import DateRangeFilter, { currentMonthRange } from './DateRangeFilter';
import { exportRows } from './exportUtils';
import { getCurrentChurchId, ATTENDANCE_TYPE_LABELS, type AttendanceType } from '../../lib/pastoralKanbanService';
import { JOURNEY_PROFILE_LABELS, JOURNEY_PROFILE_COLORS, type JourneyProfile } from '../../lib/pastoralJourneyDefault';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface DashboardData {
  pipeline: {
    total: number;
    porColuna: Array<{ key: string; name: string; color: string; total: number }>;
    porGrupo: Array<{ profile: string; total: number }>;
    porTipo: Array<{ tipo: string; total: number }>;
    atrasados: number;
    urgentes: number;
    porDia: Array<{ dia: string; total: number }>;
  };
  cronograma: {
    pessoasAtivas: number;
    concluidas: number;
    certificados: number;
    enviadas: number;
    naFila: number;
    erros: number;
    responderam: number;
    taxaResposta: number;
    porSemana: Array<{ semana: string; total: number }>;
    porGrupo: Array<{ profile: string; ativas: number; concluidas: number }>;
  };
}

const profileLabel = (p: string) =>
  p === 'sem' ? 'Sem classificação' : JOURNEY_PROFILE_LABELS[p as JourneyProfile] ?? p;
const profileColor = (p: string) =>
  p === 'sem' ? '#cbd5e1' : JOURNEY_PROFILE_COLORS[p as JourneyProfile] ?? '#8b5cf6';

function Card({ label, value, hint, color = 'text-slate-800', icon }: {
  label: string; value: string | number; hint?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
        {icon}{label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

/** Barras horizontais rotuladas. */
function BarList({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate text-slate-600" title={r.label}>{r.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden min-w-[60px]">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.round((r.value / max) * 100)}%`, background: r.color }} />
          </div>
          <span className="w-10 text-right font-semibold text-slate-700 tabular-nums">{r.value}</span>
        </div>
      ))}
      {!rows.length && <div className="text-xs text-slate-400 py-2">Sem dados no período.</div>}
    </div>
  );
}

/** Sparkline de entrada por dia. */
function Sparkline({ points }: { points: Array<{ dia: string; total: number }> }) {
  if (points.length < 2) {
    return <div className="text-xs text-slate-400 py-4 text-center">Poucos dias no período para o gráfico.</div>;
  }
  const max = Math.max(...points.map(p => p.total));
  const W = 600, H = 90;
  const dx = W / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * dx).toFixed(1)} ${(H - (p.total / max) * (H - 12) - 6).toFixed(1)}`)
    .join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="rgb(139 92 246 / 0.12)" />
        <path d={path} fill="none" stroke="rgb(139 92 246)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{new Date(points[0].dia + 'T12:00').toLocaleDateString('pt-BR')}</span>
        <span>pico: {max}/dia</span>
        <span>{new Date(points[points.length - 1].dia + 'T12:00').toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  );
}

export default function PastoralDashboard() {
  const churchId = getCurrentChurchId();
  const [{ from: dateFrom, to: dateTo }, setDateRange] = useState(currentMonthRange);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (churchId) params.set('churchId', churchId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/pastoral/dashboard?${params}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar o dashboard');
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar o dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [churchId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  /** Exporta os blocos do dashboard num arquivo só, com a coluna Bloco. */
  const exportar = (format: 'csv' | 'xlsx') => {
    if (!data) return;
    const linhas: Array<Record<string, string | number>> = [];
    const push = (bloco: string, item: string, valor: number, extra = '') =>
      linhas.push({ Bloco: bloco, Item: item, Valor: valor, Observação: extra });

    push('Período', `${dateFrom} a ${dateTo}`, data.pipeline.total, 'atendimentos no período');
    for (const c of data.pipeline.porColuna) push('Pipeline · Coluna', c.name, c.total);
    for (const g of data.pipeline.porGrupo) push('Pipeline · Grupo', profileLabel(g.profile), g.total);
    for (const t of data.pipeline.porTipo) {
      push('Pipeline · Tipo', ATTENDANCE_TYPE_LABELS[t.tipo as AttendanceType] ?? t.tipo, t.total);
    }
    push('Pipeline · Alertas', 'Atrasados (SLA)', data.pipeline.atrasados);
    push('Pipeline · Alertas', 'Urgentes', data.pipeline.urgentes);
    push('Cronograma', 'Em acompanhamento', data.cronograma.pessoasAtivas);
    push('Cronograma', 'Concluíram o mês', data.cronograma.concluidas);
    push('Cronograma', 'Certificados emitidos', data.cronograma.certificados);
    push('Cronograma', 'Mensagens enviadas', data.cronograma.enviadas);
    push('Cronograma', 'Responderam', data.cronograma.responderam, `${data.cronograma.taxaResposta}% de resposta`);
    push('Cronograma', 'Na fila', data.cronograma.naFila);
    push('Cronograma', 'Erros de envio', data.cronograma.erros);
    for (const s of data.cronograma.porSemana) push('Cronograma · Semana', `Semana ${s.semana}`, s.total);
    for (const g of data.cronograma.porGrupo) {
      push('Cronograma · Grupo', `${profileLabel(g.profile)} — ativas`, g.ativas);
      push('Cronograma · Grupo', `${profileLabel(g.profile)} — concluídas`, g.concluidas);
    }
    for (const d of data.pipeline.porDia) push('Pipeline · Entrada por dia', d.dia, d.total);

    exportRows(linhas, `dashboard-pastoral-${dateFrom}_${dateTo}`, format);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-sm text-slate-400">Sem dados para o período.</div>;
  }

  const { pipeline: pp, cronograma: cr } = data;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto print:overflow-visible" id="pastoral-dashboard">
      {/* filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-2 print:hidden">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo}
          onChange={(from, to) => setDateRange({ from, to })} />
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => exportar('csv')}
            className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportar('xlsx')}
            className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button onClick={() => window.print()}
            className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          <button onClick={load}
            className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold">Gestão Pastoral — Dashboard</h1>
        <p className="text-xs text-slate-500">
          Período de {new Date(dateFrom + 'T12:00').toLocaleDateString('pt-BR')} a{' '}
          {new Date(dateTo + 'T12:00').toLocaleDateString('pt-BR')} · emitido em{' '}
          {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      {/* ── Pipeline ── */}
      <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
        <LayoutDashboard className="w-4 h-4 text-slate-400" /> Pipeline de Atendimento
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <Card label="Atendimentos" value={pp.total} />
        {pp.porColuna.map(c => (
          <Card key={c.key} label={c.name} value={c.total} color="" />
        ))}
        <Card label="Atrasados (SLA)" value={pp.atrasados} color="text-red-600"
          icon={<AlertTriangle className="w-3 h-3" />} />
        <Card label="Urgentes" value={pp.urgentes} color="text-amber-600"
          icon={<Flame className="w-3 h-3" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Por grupo de chegada</h3>
          <BarList rows={pp.porGrupo.map(g => ({
            label: profileLabel(g.profile), value: g.total, color: profileColor(g.profile),
          }))} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Por tipo de atendimento</h3>
          <BarList rows={pp.porTipo.slice(0, 8).map(t => ({
            label: ATTENDANCE_TYPE_LABELS[t.tipo as AttendanceType] ?? t.tipo,
            value: t.total, color: '#6366f1',
          }))} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Entrada de pessoas por dia</h3>
        <Sparkline points={pp.porDia} />
      </div>

      {/* ── Cronograma ── */}
      <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-2 print:break-before-page">
        <MessageCircle className="w-4 h-4 text-slate-400" /> Cronograma de Acompanhamento
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Card label="Em acompanhamento" value={cr.pessoasAtivas} color="text-violet-600" />
        <Card label="Concluíram o mês" value={cr.concluidas} color="text-emerald-600" />
        <Card label="Certificados" value={cr.certificados} icon={<Award className="w-3 h-3" />} />
        <Card label="Enviadas" value={cr.enviadas} />
        <Card label="Responderam" value={cr.responderam} color="text-emerald-600"
          hint={`${cr.taxaResposta}% de resposta`} />
        <Card label="Na fila" value={cr.naFila} color="text-amber-600" />
        <Card label="Erros" value={cr.erros} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">
            Em que semana estão <span className="font-normal text-slate-400">— só quem está ativo</span>
          </h3>
          <BarList rows={cr.porSemana.map(s => ({
            label: `Semana ${s.semana}`, value: s.total, color: '#8b5cf6',
          }))} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Acompanhamento por grupo</h3>
          <div className="flex flex-col gap-3">
            {cr.porGrupo.map(g => (
              <div key={g.profile}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium" style={{ color: profileColor(g.profile) }}>
                    {profileLabel(g.profile)}
                  </span>
                  <span className="text-slate-500">
                    {g.ativas} ativa(s) · {g.concluidas} concluída(s)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="h-full" style={{
                    width: `${(g.ativas / Math.max(1, g.ativas + g.concluidas)) * 100}%`,
                    background: profileColor(g.profile),
                  }} />
                  <div className="h-full bg-emerald-400" style={{
                    width: `${(g.concluidas / Math.max(1, g.ativas + g.concluidas)) * 100}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
