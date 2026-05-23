"use client";
import { useState, useEffect, useCallback } from "react";
import { CreditCard, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";

interface Payment {
  id: string;
  stripeSessionId: string;
  valor: number;
  moeda: string;
  metodo: string;
  tipo: string;
  status: string;
  descricao: string | null;
  paidAt: string | null;
  createdAt: string;
  valorRefunded: number | null;
}

interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  proximaCobranca: string | null;
  createdAt: string;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const STATUS_COLORS: Record<string, string> = {
  aprovado: "bg-green-100 text-green-700",
  pendente: "bg-yellow-100 text-yellow-700",
  falhou: "bg-red-100 text-red-700",
  reembolsado: "bg-blue-100 text-blue-700",
  cancelado: "bg-slate-100 text-slate-600",
};

const SUB_STATUS_COLORS: Record<string, string> = {
  ativa: "bg-green-100 text-green-700",
  pausada: "bg-yellow-100 text-yellow-700",
  cancelada: "bg-red-100 text-red-700",
  passado_prazo: "bg-red-100 text-red-600",
};

function getCampoId(): string {
  try {
    const user = JSON.parse(localStorage.getItem("mrm_user") || "{}");
    return user.campoId || user.campo_id || "";
  } catch {
    return "";
  }
}

function getUserId(): string {
  try {
    const user = JSON.parse(localStorage.getItem("mrm_user") || "{}");
    return user.id || user.userId || "";
  } catch {
    return "";
  }
}

export default function MeusPagamentos() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pagamentos" | "assinaturas">("pagamentos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requestingRefund, setRequestingRefund] = useState<string | null>(null);
  const [refundMotivo, setRefundMotivo] = useState("");
  const [refundSuccess, setRefundSuccess] = useState(false);

  const campoId = getCampoId();
  const userId = getUserId();

  const load = useCallback(async () => {
    if (!campoId || !userId) return;
    setLoading(true);
    try {
      const [pData, sData] = await Promise.all([
        authFetch<{ items: Payment[] }>(`/api/stripe/payments?campoId=${campoId}&userId=${userId}&limit=50`),
        authFetch<{ items: Subscription[] }>(`/api/stripe/subscriptions?campoId=${campoId}&userId=${userId}&limit=20`),
      ]);
      setPayments(pData.items);
      setSubscriptions(sData.items);
    } finally {
      setLoading(false);
    }
  }, [campoId, userId]);

  useEffect(() => { load(); }, [load]);

  async function solicitarReembolso(paymentId: string) {
    setRequestingRefund(null);
    try {
      await authFetch("/api/stripe/refunds", {
        method: "POST",
        body: JSON.stringify({ paymentId, motivo: refundMotivo }),
      });
      setRefundSuccess(true);
      setRefundMotivo("");
      setTimeout(() => setRefundSuccess(false), 4000);
      await load();
    } catch {}
  }

  if (!campoId || !userId) {
    return (
      <div className="p-6 flex items-center gap-2 text-red-500 text-sm">
        <AlertCircle className="w-4 h-4" /> Usuário não identificado.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <CreditCard className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Pagamentos</h1>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {refundSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          Solicitação de reembolso enviada com sucesso! Aguarde a aprovação.
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {([["pagamentos", "Pagamentos"], ["assinaturas", "Assinaturas"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setActiveTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === k
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center text-sm text-slate-400 py-8">Carregando...</div>
      )}

      {!loading && activeTab === "pagamentos" && (
        <div className="space-y-2">
          {payments.length === 0 && (
            <div className="text-center text-sm text-slate-400 bg-white rounded-xl border border-slate-200 py-8">
              Nenhum pagamento encontrado
            </div>
          )}
          {payments.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800">{p.descricao || "Pagamento"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-sm font-semibold text-slate-700">{fmt(p.valor)}</span>
                    <span className="text-xs text-slate-400 capitalize">{p.metodo}</span>
                    <span className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                {expandedId === p.id
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />
                }
              </button>

              {expandedId === p.id && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><span className="text-slate-400">Tipo:</span> <span className="capitalize">{p.tipo}</span></div>
                    <div><span className="text-slate-400">Moeda:</span> {p.moeda.toUpperCase()}</div>
                    {p.paidAt && (
                      <div><span className="text-slate-400">Pago em:</span> {new Date(p.paidAt).toLocaleDateString("pt-BR")}</div>
                    )}
                    {(p.valorRefunded ?? 0) > 0 && (
                      <div><span className="text-slate-400">Reembolsado:</span> {fmt(p.valorRefunded ?? 0)}</div>
                    )}
                    <div className="col-span-2">
                      <span className="text-slate-400">ID:</span> <span className="font-mono">{p.stripeSessionId}</span>
                    </div>
                  </div>

                  {p.status === "aprovado" && (p.valorRefunded ?? 0) < p.valor && (
                    <>
                      {requestingRefund === p.id ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[60px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Motivo do reembolso (opcional)"
                            value={refundMotivo}
                            onChange={(e) => setRefundMotivo(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => solicitarReembolso(p.id)}
                              className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                            >
                              Confirmar Solicitação
                            </button>
                            <button
                              onClick={() => setRequestingRefund(null)}
                              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRequestingRefund(p.id)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Solicitar reembolso
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && activeTab === "assinaturas" && (
        <div className="space-y-2">
          {subscriptions.length === 0 && (
            <div className="text-center text-sm text-slate-400 bg-white rounded-xl border border-slate-200 py-8">
              Nenhuma assinatura ativa
            </div>
          )}
          {subscriptions.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500 truncate max-w-[200px]">{s.stripePriceId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SUB_STATUS_COLORS[s.status] || "bg-slate-100 text-slate-600"}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Desde {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                    {s.proximaCobranca && ` · Próx. cobrança: ${new Date(s.proximaCobranca).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
