"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, Download, RefreshCw, ExternalLink } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";

interface Payment {
  id: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  valor: number;
  moeda: string;
  metodo: string;
  tipo: string;
  status: string;
  descricao: string | null;
  userId: string | null;
  churchId: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface Props {
  campoId: string;
}

const STATUS_COLORS: Record<string, string> = {
  aprovado: "bg-green-100 text-green-700",
  pendente: "bg-yellow-100 text-yellow-700",
  falhou: "bg-red-100 text-red-700",
  reembolsado: "bg-blue-100 text-blue-700",
  cancelado: "bg-slate-100 text-slate-600",
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function StripeTransactions({ campoId }: Props) {
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [metodo, setMetodo] = useState("");
  const [search, setSearch] = useState("");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ campoId, page: String(page), limit: String(limit) });
      if (status) params.set("status", status);
      if (metodo) params.set("metodo", metodo);
      const data = await authFetch<{ items: Payment[]; total: number }>(`/api/stripe/payments?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [campoId, page, status, metodo]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / limit);

  const filtered = search
    ? items.filter((i) =>
        i.stripeSessionId.includes(search) ||
        (i.descricao || "").toLowerCase().includes(search.toLowerCase()) ||
        (i.userId || "").includes(search)
      )
    : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, descrição..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="aprovado">Aprovado</option>
          <option value="pendente">Pendente</option>
          <option value="falhou">Falhou</option>
          <option value="reembolsado">Reembolsado</option>
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={metodo} onChange={(e) => { setMetodo(e.target.value); setPage(1); }}>
          <option value="">Todos os métodos</option>
          <option value="card">Cartão</option>
          <option value="pix">PIX</option>
        </select>
        <button onClick={load} className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">ID / Sessão</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Método</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Data</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Carregando...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhum pagamento encontrado</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-slate-500 truncate max-w-[160px]">{p.stripeSessionId}</div>
                  {p.stripePaymentIntentId && (
                    <div className="font-mono text-xs text-slate-400 truncate max-w-[160px]">{p.stripePaymentIntentId}</div>
                  )}
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">{p.descricao || "—"}</td>
                <td className="px-4 py-3 capitalize">{p.metodo}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(p.valor)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{total} registros</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">Anterior</button>
            <span className="px-3 py-1">{page} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">Próximo</button>
          </div>
        </div>
      )}
    </div>
  );
}
