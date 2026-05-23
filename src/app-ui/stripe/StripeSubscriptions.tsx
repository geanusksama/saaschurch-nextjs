"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Pause, XCircle, PlayCircle } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";

interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  stripeCustomerId: string | null;
  userId: string | null;
  memberId: string | null;
  status: string;
  proximaCobranca: string | null;
  canceladaEm: string | null;
  createdAt: string;
}

interface Props {
  campoId: string;
}

const STATUS_COLORS: Record<string, string> = {
  ativa: "bg-green-100 text-green-700",
  pausada: "bg-yellow-100 text-yellow-700",
  cancelada: "bg-red-100 text-red-700",
  incompleta: "bg-orange-100 text-orange-700",
  passado_prazo: "bg-red-100 text-red-600",
};

export default function StripeSubscriptions({ campoId }: Props) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ campoId, page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await authFetch<{ items: Subscription[]; total: number }>(`/api/stripe/subscriptions?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [campoId, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function doAction(id: string, action: "cancel" | "pause" | "reactivate") {
    if (action === "cancel" && !confirm("Cancelar esta assinatura? Esta ação não pode ser desfeita.")) return;
    setActionLoading(id + action);
    try {
      await authFetch(`/api/stripe/subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="ativa">Ativa</option>
          <option value="pausada">Pausada</option>
          <option value="cancelada">Cancelada</option>
          <option value="passado_prazo">Passado do prazo</option>
        </select>
        <button onClick={load} className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-slate-500 ml-auto">{total} assinaturas</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">ID Stripe</th>
              <th className="px-4 py-3 text-left">Price ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Próx. Cobrança</th>
              <th className="px-4 py-3 text-left">Criada em</th>
              <th className="px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Carregando...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhuma assinatura</td></tr>}
            {items.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[180px] truncate">{s.stripeSubscriptionId}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[160px] truncate">{s.stripePriceId}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || "bg-slate-100 text-slate-600"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {s.proximaCobranca ? new Date(s.proximaCobranca).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {s.status === "ativa" && (
                      <>
                        <button
                          onClick={() => doAction(s.id, "pause")}
                          disabled={actionLoading === s.id + "pause"}
                          title="Pausar"
                          className="p-1 text-yellow-600 hover:bg-yellow-50 rounded disabled:opacity-40"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => doAction(s.id, "cancel")}
                          disabled={actionLoading === s.id + "cancel"}
                          title="Cancelar"
                          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {s.status === "pausada" && (
                      <button
                        onClick={() => doAction(s.id, "reactivate")}
                        disabled={actionLoading === s.id + "reactivate"}
                        title="Reativar"
                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
