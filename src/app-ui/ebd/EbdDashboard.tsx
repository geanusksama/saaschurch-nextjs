"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BookOpen, DollarSign, AlertTriangle, Package,
  TrendingUp, Truck, BarChart3, Loader2, Calendar, ChevronDown,
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";

function fmt(v: number) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DashboardData {
  cards: {
    totalDistribuido: number;
    totalPendente: number;
    igrejesInadimplentes: number;
    estoquesBaixos: number;
    entregasRecentes: number;
    entradasRecentes: number;
  };
  distribuicaoPorCategoria: Array<{ nome: string; qtd: number }>;
  financeiroResumo: {
    recebidoPeriodo: number;
    pendente: number;
    comprasPeriodo: number;
  };
  topInadimplentes: Array<{ churchName: string; saldo: number }>;
  entregasRecentes: Array<{
    id: string; numeroDoc: string; dataEntrega: string; status: string; valorTotal: number;
    church: { name: string };
  }>;
  entradasRecentes: Array<{
    id: string; numNf?: string; dataEntrada: string; valorTotal: number; fornecedor?: string;
  }>;
  estoque: Array<{ produto: string; categoria: string; quantidade: number; baixo: boolean }>;
}

type Period = "mes_atual" | "mes_anterior" | "personalizado";

const STATUS_COLORS: Record<string, string> = {
  separando: "bg-yellow-100 text-yellow-800",
  separado:  "bg-blue-100 text-blue-800",
  entregue:  "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  separando: "Separando", separado: "Separado", entregue: "Entregue", cancelado: "Cancelado",
};

function getPeriodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  if (period === "mes_atual") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      to:   new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    };
  }
  if (period === "mes_anterior") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
      to:   new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
    };
  }
  return { from: customFrom, to: customTo };
}

export default function EbdDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("mes_atual");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const campoId = (() => {
    try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId; } catch { return null; }
  })();

  const fetchData = useCallback(async () => {
    if (!campoId) { setLoading(false); setError("campoId não encontrado"); return; }
    setLoading(true);
    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const params = new URLSearchParams({ campoId });
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    authFetch<DashboardData>(`${apiBase}/ebd/dashboard?${params}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar dashboard"); setLoading(false); });
  }, [campoId, period, customFrom, customTo]);

  useEffect(() => {
    if (period === "personalizado" && (!customFrom || !customTo)) return;
    fetchData();
  }, [fetchData, period, customFrom, customTo]);

  const { from: dispFrom, to: dispTo } = getPeriodRange(period, customFrom, customTo);
  const periodLabel = period === "mes_atual" ? "Mês atual" : period === "mes_anterior" ? "Mês anterior" : `${dispFrom} a ${dispTo}`;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-lg">{error}</div>
  );

  const c = data?.cards;

  const cards = [
    { label: "Revistas distribuídas", value: c?.totalDistribuido ?? 0, icon: BookOpen, color: "text-purple-600 bg-purple-50" },
    { label: "Financeiro pendente", value: `R$ ${fmt(c?.totalPendente ?? 0)}`, icon: DollarSign, color: "text-orange-600 bg-orange-50" },
    { label: "Igrejas inadimplentes", value: c?.igrejesInadimplentes ?? 0, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
    { label: "Estoque baixo", value: c?.estoquesBaixos ?? 0, icon: Package, color: "text-yellow-600 bg-yellow-50" },
    { label: "Entregas no período", value: c?.entregasRecentes ?? 0, icon: Truck, color: "text-blue-600 bg-blue-50" },
    { label: "Compras no período", value: c?.entradasRecentes ?? 0, icon: TrendingUp, color: "text-green-600 bg-green-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard EBD</h1>
            <p className="text-slate-500 text-sm">Gestão da Escola Bíblica Dominical</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-slate-400" />
          {(["mes_atual", "mes_anterior", "personalizado"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                period === p
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {p === "mes_atual" ? "Mês atual" : p === "mes_anterior" ? "Mês anterior" : "Personalizado"}
            </button>
          ))}
          {period === "personalizado" && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </>
          )}
          <span className="text-xs text-slate-400">{periodLabel}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Resumo financeiro do período */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700">Recebido no período</p>
          <p className="text-2xl font-bold text-green-900 mt-1">R$ {fmt(data?.financeiroResumo?.recebidoPeriodo ?? 0)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs font-medium text-orange-700">Total pendente (geral)</p>
          <p className="text-2xl font-bold text-orange-900 mt-1">R$ {fmt(data?.financeiroResumo?.pendente ?? 0)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-700">Compras no período</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">R$ {fmt(data?.financeiroResumo?.comprasPeriodo ?? 0)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribuição por categoria */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Revistas distribuídas por categoria</h2>
          {(data?.distribuicaoPorCategoria ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Sem distribuições no período</p>
          ) : (
            <div className="space-y-3">
              {data?.distribuicaoPorCategoria.sort((a, b) => b.qtd - a.qtd).map((item) => {
                const total = data.distribuicaoPorCategoria.reduce((s, i) => s + i.qtd, 0);
                const pct = total ? Math.round((item.qtd / total) * 100) : 0;
                return (
                  <div key={item.nome}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{item.nome}</span>
                      <span className="text-slate-500">{item.qtd} un ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top inadimplentes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Maiores devedores
          </h2>
          {(data?.topInadimplentes ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma dívida pendente</p>
          ) : (
            <div className="space-y-3">
              {data?.topInadimplentes.map((t, i) => {
                const maxSaldo = Math.max(...(data?.topInadimplentes.map((x) => x.saldo) ?? [1]));
                const pct = maxSaldo ? Math.round((t.saldo / maxSaldo) * 100) : 0;
                return (
                  <div key={t.churchName}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">
                        <span className="text-slate-400 mr-1">{i + 1}.</span>{t.churchName}
                      </span>
                      <span className="font-semibold text-red-600">R$ {fmt(t.saldo)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Entregas no período */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Entregas no período</h2>
          {(data?.entregasRecentes ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma entrega no período</p>
          ) : (
            <div className="space-y-2">
              {data?.entregasRecentes.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.church.name}</p>
                    <p className="text-xs text-slate-500">{e.numeroDoc} · {new Date(e.dataEntrega).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">R$ {fmt(e.valorTotal)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] || "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[e.status] || e.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compras/Entradas no período */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" /> Compras no período
          </h2>
          {(data?.entradasRecentes ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma compra no período</p>
          ) : (
            <div className="space-y-2">
              {data?.entradasRecentes.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {e.fornecedor || "Fornecedor não informado"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.numNf ? `NF ${e.numNf} · ` : ""}{new Date(e.dataEntrada).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-green-700">R$ {fmt(Number(e.valorTotal))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Estoque crítico */}
      {(data?.estoque ?? []).filter((e) => e.baixo).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h2 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Estoque baixo (≤ 10 unidades)
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.estoque.filter((e) => e.baixo).map((e) => (
              <div key={e.produto} className="bg-white rounded-lg p-3 border border-yellow-200">
                <p className="text-sm font-medium text-slate-800">{e.produto}</p>
                <p className="text-xs text-slate-500">{e.categoria}</p>
                <p className="text-lg font-bold text-red-600 mt-1">{e.quantidade} un</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
