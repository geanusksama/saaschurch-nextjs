"use client";
import { useState, useEffect, useCallback } from "react";
import { DollarSign, CreditCard, Users, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { authFetch } from "../../lib/secretariaHooks";

interface DashboardData {
  receita: { total: number; mes: number; mesAnterior: number; variacaoMes: number; totalReembolsado: number };
  pagamentos: { total: number; pendentes: number; porMetodo: { metodo: string; total: number; count: number }[]; porStatus: { status: string; count: number }[] };
  assinaturas: { ativas: number; canceladas: number };
  reembolsos: { pendentes: number };
  grafico: { mes: string; total: number }[];
}

interface Props {
  campoId: string;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function Card({ title, value, sub, icon: Icon, trend }: { title: string; value: string; sub?: string; icon: React.ElementType; trend?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{title}</span>
        <Icon className="w-5 h-5 text-indigo-400" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs mt-1 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend >= 0 ? "+" : ""}{trend}% vs mês anterior
        </div>
      )}
    </div>
  );
}

export default function StripeDashboard({ campoId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch<DashboardData>(`/api/stripe/dashboard?campoId=${campoId}`);
      setData(data);
    } finally {
      setLoading(false);
    }
  }, [campoId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Carregando dashboard...</div>;
  if (!data) return <div className="p-6 text-sm text-red-500">Erro ao carregar dados.</div>;

  const graficoPorMes = data.grafico.map((g) => ({
    mes: g.mes,
    Receita: g.total,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Receita Total" value={fmt(data.receita.total)} sub={`Reembolsado: ${fmt(data.receita.totalReembolsado)}`} icon={DollarSign} />
        <Card title="Receita do Mês" value={fmt(data.receita.mes)} trend={data.receita.variacaoMes} icon={TrendingUp} />
        <Card title="Assinaturas Ativas" value={String(data.assinaturas.ativas)} sub={`${data.assinaturas.canceladas} canceladas`} icon={Users} />
        <Card title="Pagamentos Pendentes" value={String(data.pagamentos.pendentes)} sub={`Total: ${data.pagamentos.total}`} icon={CreditCard} />
      </div>

      {data.reembolsos.pendentes > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{data.reembolsos.pendentes}</strong> reembolso(s) aguardando aprovação</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold mb-4">Receita — Últimos 6 Meses</h3>
          {graficoPorMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={graficoPorMes}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="Receita" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">Sem dados</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold mb-4">Pagamentos por Método</h3>
          <div className="space-y-3">
            {data.pagamentos.porMetodo.length === 0 && <p className="text-sm text-slate-400">Sem dados</p>}
            {data.pagamentos.porMetodo.map((m) => (
              <div key={m.metodo} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm capitalize font-medium">{m.metodo}</span>
                  <span className="text-xs text-slate-400">{m.count} transações</span>
                </div>
                <span className="text-sm font-semibold">{fmt(m.total)}</span>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold mb-3 mt-6">Status dos Pagamentos</h3>
          <div className="space-y-2">
            {data.pagamentos.porStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{s.status}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
