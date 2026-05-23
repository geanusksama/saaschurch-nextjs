"use client";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";

interface Refund {
  id: string;
  paymentId: string;
  valor: number;
  moeda: string;
  motivo: string | null;
  status: string;
  stripeRefundId: string | null;
  solicitadoPor: string | null;
  aprovadoPor: string | null;
  motivoRejeicao: string | null;
  createdAt: string;
  payment: { valor: number; descricao: string | null; status: string };
}

interface Props {
  campoId: string;
}

const STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-yellow-100 text-yellow-700",
  processado: "bg-green-100 text-green-700",
  rejeitado: "bg-red-100 text-red-700",
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function StripeReembolsos({ campoId }: Props) {
  const [items, setItems] = useState<Refund[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ campoId, page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await authFetch<{ items: Refund[]; total: number }>(`/api/stripe/refunds?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [campoId, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function doApprove(id: string) {
    if (!confirm("Processar este reembolso no Stripe?")) return;
    setActionLoading(id);
    try {
      await authFetch(`/api/stripe/refunds/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function doReject() {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await authFetch(`/api/stripe/refunds/${rejectModal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", motivoRejeicao: rejectMotivo }),
      });
      setRejectModal(null);
      setRejectMotivo("");
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
          <option value="solicitado">Solicitado</option>
          <option value="processado">Processado</option>
          <option value="rejeitado">Rejeitado</option>
        </select>
        <button onClick={load} className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-slate-500 ml-auto">{total} reembolsos</span>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Pagamento / Descrição</th>
              <th className="px-4 py-3 text-right">Valor Reembolso</th>
              <th className="px-4 py-3 text-left">Motivo</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Solicitado em</th>
              <th className="px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Carregando...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhum reembolso</td></tr>}
            {items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="text-xs text-slate-500 truncate max-w-[180px]">{r.paymentId}</div>
                  <div className="text-xs text-slate-400">{r.payment?.descricao || "—"}</div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(r.valor)}</td>
                <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{r.motivo || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || "bg-slate-100 text-slate-600"}`}>
                    {r.status}
                  </span>
                  {r.motivoRejeicao && <div className="text-xs text-red-500 mt-0.5">{r.motivoRejeicao}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  {r.status === "solicitado" && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => doApprove(r.id)}
                        disabled={actionLoading === r.id}
                        title="Aprovar"
                        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setRejectModal({ id: r.id }); setRejectMotivo(""); }}
                        disabled={actionLoading === r.id}
                        title="Rejeitar"
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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

      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-3">Rejeitar Reembolso</h3>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Motivo da rejeição (opcional)"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={doReject} disabled={!!actionLoading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {actionLoading ? "Processando..." : "Confirmar Rejeição"}
              </button>
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
