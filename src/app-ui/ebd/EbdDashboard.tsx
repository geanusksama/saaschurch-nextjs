"use client";
import { useEffect, useState } from "react";
import { BookOpen, DollarSign, AlertTriangle, Package, TrendingUp, Truck, BarChart3, Loader2 } from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  entregasRecentes: Array<{
    id: string; numeroDoc: string; dataEntrega: string; status: string; valorTotal: number;
    church: { name: string };
  }>;
  estoque: Array<{ produto: string; categoria: string; quantidade: number; baixo: boolean }>;
}

const STATUS_COLORS: Record<string, string> = {
  separando: "bg-yellow-100 text-yellow-800",
  separado: "bg-blue-100 text-blue-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

export default function EbdDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const campoId = (() => {
    try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId; } catch { return null; }
  })();

  useEffect(() => {
    if (!campoId) { setLoading(false); setError("campoId não encontrado"); return; }
    authFetch<DashboardData>(`${apiBase}/ebd/dashboard?campoId=${campoId}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar dashboard"); setLoading(false); });
  }, [campoId]);

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
    { label: "Revistas distribuídas", value: c?.totalDistribuido ?? 0, icon: BookOpen, color: "text-purple-600 bg-purple-50", unit: "un" },
    { label: "Financeiro pendente", value: `R$ ${fmt(c?.totalPendente ?? 0)}`, icon: DollarSign, color: "text-orange-600 bg-orange-50" },
    { label: "Igrejas inadimplentes", value: c?.igrejesInadimplentes ?? 0, icon: AlertTriangle, color: "text-red-600 bg-red-50", unit: "igrejas" },
    { label: "Estoque baixo", value: c?.estoquesBaixos ?? 0, icon: Package, color: "text-yellow-600 bg-yellow-50", unit: "produtos" },
    { label: "Entregas recentes", value: c?.entregasRecentes ?? 0, icon: Truck, color: "text-blue-600 bg-blue-50" },
    { label: "Entradas recentes", value: c?.entradasRecentes ?? 0, icon: TrendingUp, color: "text-green-600 bg-green-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <BarChart3 className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard EBD</h1>
          <p className="text-slate-500 text-sm">Gestão da Escola Bíblica Dominical</p>
        </div>
      </div>

      {/* Cards */}
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribuição por Categoria */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Revistas distribuídas por categoria</h2>
          {(data?.distribuicaoPorCategoria ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Sem dados de distribuição</p>
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

        {/* Entregas recentes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Entregas recentes</h2>
          {(data?.entregasRecentes ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma entrega registrada</p>
          ) : (
            <div className="space-y-3">
              {data?.entregasRecentes.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.church.name}</p>
                    <p className="text-xs text-slate-500">{e.numeroDoc} · {new Date(e.dataEntrega).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">R$ {fmt(e.valorTotal)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] || "bg-slate-100 text-slate-600"}`}>
                      {e.status}
                    </span>
                  </div>
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
