"use client";
import { useEffect, useState } from "react";
import { Clock, Search, Filter } from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";

interface HistoricoItem {
  id: string; tipo: string; titulo: string; descricao?: string; valor?: number; data: string;
  church?: { id: string; name: string } | null;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  entrada_estoque: { label: "Entrada Estoque", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  retirada:        { label: "Retirada",         color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500" },
  entrega:         { label: "Entrega",           color: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  pagamento:       { label: "Pagamento",         color: "bg-teal-100 text-teal-700",  dot: "bg-teal-500" },
  ajuste:          { label: "Ajuste",            color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
  cancelamento:    { label: "Cancelamento",      color: "bg-red-100 text-red-700",    dot: "bg-red-500" },
};

function fmt(v: number) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function useCampoId() { try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string; } catch { return ""; } }

export default function EbdHistorico() {
  const campoId = useCampoId();
  const [items, setItems] = useState<HistoricoItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!campoId) return;
    setLoading(true);
    const url = `${apiBase}/ebd/historico?campoId=${campoId}${filterTipo ? `&tipo=${filterTipo}` : ""}`;
    const data = await authFetch<unknown>(url).catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [campoId, filterTipo]);

  // Agrupar por data
  const grouped: Record<string, HistoricoItem[]> = {};
  for (const item of items) {
    if (search) {
      const q = search.toLowerCase();
      if (!item.titulo.toLowerCase().includes(q) && !(item.church?.name ?? "").toLowerCase().includes(q)) continue;
    }
    const key = new Date(item.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg"><Clock className="w-6 h-6 text-slate-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Histórico EBD</h1>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-52 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
          <option value="">Todos os eventos</option>
          {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-slate-400 text-center py-12">Nenhum evento encontrado</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{date}</h3>
              <div className="relative pl-6 space-y-4">
                {/* Linha vertical */}
                <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-slate-200" />
                {events.map((item) => {
                  const cfg = TIPO_CONFIG[item.tipo] || { label: item.tipo, color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
                  return (
                    <div key={item.id} className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div className={`absolute -left-4 mt-1 w-3 h-3 rounded-full border-2 border-white ${cfg.dot}`} />
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                              {item.church && <span className="text-xs text-slate-400">{item.church.name}</span>}
                            </div>
                            <p className="font-medium text-slate-800 text-sm">{item.titulo}</p>
                            {item.descricao && <p className="text-xs text-slate-500 mt-0.5">{item.descricao}</p>}
                          </div>
                          {item.valor != null && (
                            <p className="text-sm font-bold text-slate-900 ml-4 whitespace-nowrap">R$ {fmt(item.valor)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
