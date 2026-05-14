import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Eye,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  ThumbsUp,
  X,
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CredentialRequest {
  id: number;
  nome?: string | null;
  tipo?: string | null;
  modelo?: string | null;
  via?: number | null;
  numero?: string | null;
  igrejasolicitante?: string | null;
  situacao?: string | null;
  tiporequisicao?: string | null;
  idrequisicao?: string | null;
  idtbmembro?: number | null;
  kan_card_id?: string | null;
  card_protocol?: string | null;
  frente?: string | null;
  verso?: string | null;
  datavalidade?: string | null;
  created_at?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("mrm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SITUACOES = ["Pendente", "Aprovado", "Entregue", "Cancelado"] as const;
type Situacao = (typeof SITUACOES)[number];

function SituacaoBadge({ s }: { s?: string | null }) {
  const map: Record<string, string> = {
    Pendente: "bg-amber-100 text-amber-700",
    Aprovado: "bg-blue-100 text-blue-700",
    Entregue: "bg-green-100 text-green-700",
    Cancelado: "bg-red-100 text-red-600",
  };
  const label = s ?? "—";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[label] ?? "bg-slate-100 text-slate-500"}`}>
      {label}
    </span>
  );
}

function formatCredNum(n?: string | null, via?: number | null) {
  if (!n) return "—";
  return via ? `${n} (${via}ª via)` : n;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function pipelineHref(request: CredentialRequest) {
  const query = request.card_protocol || request.kan_card_id || request.numero || request.nome || "";
  return `/app-ui/secretariat/pipeline${query ? `?q=${encodeURIComponent(query)}` : ""}`;
}

const PAGE_SIZE = 10;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SolicitacoesCredencial() {
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSituacao, setFilterSituacao] = useState("");
  const [page, setPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState<CredentialRequest | null>(null);
  const [viewTarget, setViewTarget] = useState<CredentialRequest | null>(null);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSituacao) params.set("situacao", filterSituacao);
      if (search) params.set("nome", search);
      const res = await fetch(`${apiBase}/credential-requests?${params}`, { headers: authHeaders() });
      if (res.ok) setRequests(await res.json());
      else showToast(false, "Erro ao carregar solicitações.");
    } catch {
      showToast(false, "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterSituacao]);

  // client-side search filter
  const filtered = requests.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.nome, r.numero, r.igrejasolicitante, r.tipo].some((v) => v?.toLowerCase().includes(q));
  });

  // stats
  const total = filtered.length;
  const pendentes = filtered.filter((r) => r.situacao === "Pendente").length;
  const aprovados = filtered.filter((r) => r.situacao === "Aprovado").length;
  const entregues = filtered.filter((r) => r.situacao === "Entregue").length;

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleApprove(nextSituacao: Situacao) {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const res = await fetch(`${apiBase}/credential-requests/${approveTarget.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ situacao: nextSituacao }),
      });
      if (res.ok) {
        showToast(true, `Status atualizado para ${nextSituacao}.`);
        setApproveTarget(null);
        load();
      } else {
        showToast(false, "Erro ao atualizar status.");
      }
    } catch {
      showToast(false, "Erro de conexão.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitações de Credencial</h1>
          <p className="text-slate-500 text-sm">Gerencie as solicitações de credenciais da organização</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, color: "blue", icon: CreditCard },
          { label: "Pendentes", value: pendentes, color: "amber", icon: AlertTriangle },
          { label: "Aprovados", value: aprovados, color: "sky", icon: ThumbsUp },
          { label: "Entregues", value: entregues, color: "green", icon: CheckCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${color}-100`}>
              <Icon size={20} className={`text-${color}-600`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, número ou igreja..."
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => { setSearch(""); setPage(1); }}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <select
            value={filterSituacao}
            onChange={(e) => { setFilterSituacao(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">Todas as situações</option>
            {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Solicitações</h2>
          <span className="text-xs text-slate-500">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhuma solicitação encontrada.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Membro</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Protocolo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Número</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Igreja</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Situação</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.nome || "—"}</p>
                      {r.modelo && <p className="text-xs text-slate-400">{r.modelo}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {r.card_protocol ? (
                        <a
                          href={pipelineHref(r)}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-mono text-xs font-medium text-blue-700 hover:bg-blue-100"
                          title="Abrir no pipeline"
                        >
                          {r.card_protocol}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.tipo || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{formatCredNum(r.numero, r.via)}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{r.igrejasolicitante || "—"}</td>
                    <td className="px-4 py-3"><SituacaoBadge s={r.situacao} /></td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setViewTarget(r)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600"
                          title="Visualizar"
                        >
                          <Eye size={15} />
                        </button>
                        {r.card_protocol && (
                          <a
                            href={pipelineHref(r)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-700"
                            title="Abrir no pipeline"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                        {r.situacao === "Pendente" && (
                          <button
                            onClick={() => setApproveTarget(r)}
                            className="p-1.5 rounded hover:bg-blue-100 text-slate-500 hover:text-blue-700"
                            title="Aprovar"
                          >
                            <ThumbsUp size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
                <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">‹</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded border ${p === page ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50"}`}>{p}</button>
                  ))}
                  <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">›</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── APPROVE MODAL ───────────────────────────────────────────────────── */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ThumbsUp size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Atualizar Status</h3>
                <p className="text-xs text-slate-500">{approveTarget.nome}</p>
              </div>
              <button onClick={() => setApproveTarget(null)} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-700">Selecione o novo status para a solicitação <span className="font-medium">{approveTarget.numero}</span>:</p>
            <div className="space-y-2">
              {(["Aprovado", "Entregue", "Cancelado"] as Situacao[]).map((s) => (
                <button
                  key={s}
                  disabled={approving}
                  onClick={() => handleApprove(s)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <SituacaoBadge s={s} />
                  {approving ? <Loader2 size={14} className="animate-spin text-slate-400" /> : null}
                </button>
              ))}
            </div>
            <button onClick={() => setApproveTarget(null)} className="w-full border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL ──────────────────────────────────────────────────────── */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-900">Solicitação #{viewTarget.id}</h3>
              </div>
              <button onClick={() => setViewTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Card preview */}
            {(viewTarget.frente || viewTarget.verso) && (
              <div className="grid grid-cols-2 gap-4">
                {viewTarget.frente && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1">Frente</p>
                    <img src={viewTarget.frente} alt="frente" className="w-full rounded-lg border border-slate-200" />
                  </div>
                )}
                {viewTarget.verso && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1">Verso</p>
                    <img src={viewTarget.verso} alt="verso" className="w-full rounded-lg border border-slate-200" />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Membro", viewTarget.nome],
                ["Protocolo", viewTarget.card_protocol],
                ["Tipo", viewTarget.tipo],
                ["Número", formatCredNum(viewTarget.numero, viewTarget.via)],
                ["Modelo", viewTarget.modelo],
                ["Igreja", viewTarget.igrejasolicitante],
                ["Situação", viewTarget.situacao],
                ["Tipo Req.", viewTarget.tiporequisicao],
                ["Validade", fmtDate(viewTarget.datavalidade)],
                ["Data", fmtDate(viewTarget.created_at)],
              ].map(([label, val]) => val && (
                <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-medium text-slate-800 break-words">{val}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              {viewTarget.card_protocol && (
                <a
                  href={pipelineHref(viewTarget)}
                  className="flex-1 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-100"
                >
                  <ExternalLink size={14} /> Abrir no Pipeline
                </a>
              )}
              {viewTarget.situacao === "Pendente" && (
                <button
                  onClick={() => { setViewTarget(null); setApproveTarget(viewTarget); }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <ThumbsUp size={14} /> Aprovar
                </button>
              )}
              <button onClick={() => setViewTarget(null)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
