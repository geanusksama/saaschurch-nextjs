"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  DollarSign, Plus, Loader2, Save, Search, TrendingDown, TrendingUp,
  AlertTriangle, Handshake, ChevronDown, ChevronUp, CheckCircle, X, Clock,
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";
import { usePermissions } from "../../lib/usePermissions";
import { ConfirmDialog, AlertDialog } from "../../components/app-ui/shared/ConfirmDialog";

interface FinRow {
  id: string; saldo: number;
  church: { id: string; name: string };
  trimestre?: { id: string; nome: string; ano: number } | null;
  movimentos: Array<{ id: string; tipo: string; valor: number; saldoAntes: number; saldoDepois: number; data: string; descricao?: string }>;
}
interface Trimestre { id: string; nome: string; ano: number }
interface Parcela {
  id: string; numParcela: number; valor: number; dataVencimento: string;
  dataPagamento: string | null; status: string; observacao?: string;
}
interface Negociacao {
  id: string; churchId: string; titulo: string; descricao?: string;
  valorTotal: number; numParcelas: number; dataInicio: string;
  dataVencimento?: string; status: string; observacao?: string;
  church: { id: string; name: string };
  parcelas: Parcela[];
}
interface ChurchDebt {
  rows: Array<FinRow & { trimestre?: { id: string; nome: string; ano: number; dataFim: string } | null }>;
  negociacoes: Negociacao[];
  totalAcumulado: number;
  trimestresComSaldo: number;
}

const TIPO_MOV = [
  { key: "pagamento", label: "Pagamento" },
  { key: "credito", label: "Crédito" },
  { key: "desconto", label: "Desconto" },
  { key: "correcao", label: "Correção" },
  { key: "transferencia", label: "Transferência" },
  { key: "outros", label: "Outros" },
];

const NEG_STATUS: Record<string, { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-blue-100 text-blue-700" },
  fechada: { label: "Fechada", cls: "bg-green-100 text-green-700" },
  vencida: { label: "Vencida", cls: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-500" },
};

const PARC_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-yellow-100 text-yellow-700" },
  pago: { label: "Pago", cls: "bg-green-100 text-green-700" },
  vencido: { label: "Vencido", cls: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-500" },
};

function fmt(v: number) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function useCampoId() { try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string; } catch { return ""; } }
function useProfileType() { try { return (JSON.parse(localStorage.getItem("mrm_user") || "{}").profileType as string) || "church"; } catch { return "church"; } }
function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

type Tab = "contas" | "negociacoes";

export default function EbdFinanceiro() {
  const campoId = useCampoId();
  const profileType = useProfileType();
  const { canView: cv, canCreate: cc, canEdit: ce, canDelete: cd } = usePermissions(profileType);
  const [tab, setTab] = useState<Tab>("contas");
  const [rows, setRows] = useState<FinRow[]>([]);
  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [search, setSearch] = useState("");
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [filterTri, setFilterTri] = useState("");
  const [filterSit, setFilterSit] = useState("");
  const [filterNegStatus, setFilterNegStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const initialLoad = useRef(true);
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; message?: string; variant?: "danger" | "warning"; confirmLabel?: string; onConfirm: () => void } | null>(null);
  const [alertDlg, setAlertDlg] = useState<{ title: string; message?: string } | null>(null);

  // Modal de ajuste financeiro
  const [ajusteModal, setAjusteModal] = useState<{
    churchId: string; churchName: string; trimestreId: string; tipo: string;
    valor: number; data: string; descricao: string; observacao: string;
    modalTab: "trimestre" | "negociacao";
  } | null>(null);
  const [selectedParcela, setSelectedParcela] = useState<{ negId: string; parcelaId: string; valor: number; label: string } | null>(null);
  const [savingParcela, setSavingParcela] = useState(false);
  const [payingParcelaId, setPayingParcelaId] = useState<string | null>(null);
  const [churchDebt, setChurchDebt] = useState<ChurchDebt | null>(null);
  const [loadingDebt, setLoadingDebt] = useState(false);

  // Modal de negociação
  const [negModal, setNegModal] = useState<"new" | Negociacao | null>(null);
  const [negForm, setNegForm] = useState({
    churchId: "", titulo: "", descricao: "", valorTotal: 0, numParcelas: 1,
    dataInicio: new Date().toISOString().slice(0, 10), dataVencimento: "", observacao: "",
  });
  const [parcelas, setParcelas] = useState<{ numParcela: number; valor: number; dataVencimento: string }[]>([]);
  const [savingNeg, setSavingNeg] = useState(false);

  const fetchData = useCallback(async () => {
    if (!campoId) return;
    if (initialLoad.current) setPageLoading(true);
    try {
      const [r, t, n] = await Promise.all([
        authFetch<unknown>(`${apiBase}/ebd/financeiro?campoId=${campoId}${filterTri ? `&trimestreId=${filterTri}` : ""}`),
        authFetch<unknown>(`${apiBase}/ebd/trimestres?campoId=${campoId}`),
        authFetch<unknown>(`${apiBase}/ebd/negociacoes?campoId=${campoId}`),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setTrimestres(Array.isArray(t) ? t : []);
      setNegociacoes(Array.isArray(n) ? n : []);
    } catch { /* handled by authFetch */ }
    initialLoad.current = false;
    setPageLoading(false);
  }, [campoId, filterTri]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAjusteModal = async (row: FinRow, tipo: string) => {
    setSelectedParcela(null);
    setAjusteModal({
      churchId: row.church.id, churchName: row.church.name,
      trimestreId: row.trimestre?.id || "", tipo, valor: 0,
      data: new Date().toISOString().slice(0, 10), descricao: "", observacao: "",
      modalTab: "trimestre",
    });
    setLoadingDebt(true);
    try {
      const d = await authFetch<ChurchDebt>(`${apiBase}/ebd/financeiro/church/${row.church.id}?campoId=${campoId}`);
      setChurchDebt(d);
    } catch { setChurchDebt(null); }
    setLoadingDebt(false);
  };

  const saveParcelaNeg = async () => {
    if (!selectedParcela || !ajusteModal) return;
    setSavingParcela(true);
    try {
      await authFetch(`${apiBase}/ebd/negociacoes/${selectedParcela.negId}/parcelas/${selectedParcela.parcelaId}`, {
        method: "PATCH",
        body: JSON.stringify({ campoId, status: "pago", dataPagamento: ajusteModal.data }),
      });
      setAjusteModal(null); setChurchDebt(null); setSelectedParcela(null);
      await fetchData();
    } catch { setAlertDlg({ title: "Erro ao registrar pagamento", message: "Não foi possível registrar o pagamento da parcela. Tente novamente." }); }
    setSavingParcela(false);
  };

  const saveAjuste = async () => {
    if (!ajusteModal) return;
    setLoading(true);
    try {
      await authFetch(`${apiBase}/ebd/financeiro/movimentos`, {
        method: "POST",
        body: JSON.stringify({ ...ajusteModal, campoId }),
      });
      setAjusteModal(null);
      setChurchDebt(null);
      await fetchData();
    } catch { setAlertDlg({ title: "Erro ao registrar ajuste", message: "Não foi possível salvar o ajuste financeiro. Tente novamente." }); }
    setLoading(false);
  };

  // Gera parcelas automaticamente ao mudar numParcelas / valorTotal / dataInicio
  const gerarParcelas = (num: number, total: number, inicio: string) => {
    if (!num || !total || !inicio) return;
    const valorParcela = Math.round((total / num) * 100) / 100;
    const ps = Array.from({ length: num }, (_, i) => {
      const d = new Date(inicio);
      d.setMonth(d.getMonth() + i + 1);
      return { numParcela: i + 1, valor: valorParcela, dataVencimento: d.toISOString().slice(0, 10) };
    });
    setParcelas(ps);
  };

  const saveNegociacao = async () => {
    if (!negForm.churchId || !negForm.titulo || !negForm.valorTotal) return;
    setSavingNeg(true);
    try {
      await authFetch(`${apiBase}/ebd/negociacoes`, {
        method: "POST",
        body: JSON.stringify({ ...negForm, campoId, parcelas }),
      });
      setNegModal(null);
      setNegForm({ churchId: "", titulo: "", descricao: "", valorTotal: 0, numParcelas: 1, dataInicio: new Date().toISOString().slice(0, 10), dataVencimento: "", observacao: "" });
      setParcelas([]);
      await fetchData();
    } catch { setAlertDlg({ title: "Erro ao salvar negociação", message: "Não foi possível criar a negociação. Verifique os dados e tente novamente." }); }
    setSavingNeg(false);
  };

  const pagarParcela = (negId: string, parcelaId: string) => {
    setConfirmDlg({
      title: "Confirmar pagamento",
      message: "Deseja registrar o pagamento desta parcela com a data de hoje?",
      variant: "warning",
      confirmLabel: "Confirmar pagamento",
      onConfirm: async () => {
        setConfirmDlg(null);
        setPayingParcelaId(parcelaId);
        await authFetch(`${apiBase}/ebd/negociacoes/${negId}/parcelas/${parcelaId}`, {
          method: "PATCH",
          body: JSON.stringify({ campoId, status: "pago", dataPagamento: new Date().toISOString().slice(0, 10) }),
        }).catch(() => null);
        setPayingParcelaId(null);
        await fetchData();
      },
    });
  };

  const cancelarNegociacao = (id: string) => {
    setConfirmDlg({
      title: "Cancelar negociação",
      message: "Tem certeza que deseja cancelar este acordo? Esta ação não pode ser desfeita.",
      variant: "danger",
      confirmLabel: "Sim, cancelar acordo",
      onConfirm: async () => {
        setConfirmDlg(null);
        await authFetch(`${apiBase}/ebd/negociacoes/${id}?campoId=${campoId}`, { method: "DELETE" }).catch(() => null);
        await fetchData();
      },
    });
  };

  const filtered = rows.filter((r) => {
    if (search && !r.church.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSit === "pendente" && Number(r.saldo) <= 0) return false;
    if (filterSit === "quitado" && Number(r.saldo) > 0) return false;
    // Filtro de data: mantém a linha se tiver algum movimento dentro do intervalo
    if (dateFrom || dateTo) {
      const hasMovInRange = r.movimentos.some((m) => {
        const d = m.data.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
      if (!hasMovInRange && r.movimentos.length > 0) return false;
    }
    return true;
  });

  const filteredNegs = negociacoes.filter((n) => {
    if (search && !n.church.name.toLowerCase().includes(search.toLowerCase()) && !n.titulo.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterNegStatus && n.status !== filterNegStatus) return false;
    return true;
  });

  const totalPendente = filtered.reduce((s, r) => s + Math.max(0, Number(r.saldo)), 0);
  const inadimplentes = filtered.filter((r) => Number(r.saldo) > 0).length;
  const negsAbertas = negociacoes.filter((n) => n.status === "aberta").length;
  const negsVencidas = negociacoes.filter((n) => n.status === "vencida").length;

  const TIPO_MOV_LABEL: Record<string, string> = Object.fromEntries(TIPO_MOV.map((t) => [t.key, t.label]));
  const TIPO_MOV_COLOR: Record<string, string> = {
    debito: "text-red-600", pagamento: "text-green-600", credito: "text-green-600",
    desconto: "text-blue-600", correcao: "text-yellow-600", transferencia: "text-purple-600", outros: "text-slate-600",
  };

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1";

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg"><DollarSign className="w-6 h-6 text-orange-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Financeiro EBD</h1>
      </div>

      {/* Cards resumo */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-600 font-medium">Total Pendente</p>
          <p className="text-2xl font-bold text-orange-800 mt-1">R$ {fmt(totalPendente)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium">Igrejas com saldo devedor</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{inadimplentes}</p>
        </div>
        <div className={`rounded-xl p-4 border ${negsVencidas > 0 ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
          <p className={`text-xs font-medium ${negsVencidas > 0 ? "text-red-600" : "text-blue-600"}`}>
            Negociações {negsVencidas > 0 ? "vencidas" : "abertas"}
          </p>
          <p className={`text-2xl font-bold mt-1 ${negsVencidas > 0 ? "text-red-800" : "text-blue-800"}`}>
            {negsVencidas > 0 ? negsVencidas : negsAbertas}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium">Igrejas quitadas</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{filtered.filter((r) => Number(r.saldo) <= 0).length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("contas")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "contas" ? "border-orange-500 text-orange-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          Contas por Trimestre
        </button>
        {cv("ebd_negociacoes") && (
          <button onClick={() => setTab("negociacoes")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "negociacoes" ? "border-orange-500 text-orange-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Negociações / Acordos
            {negsVencidas > 0 && <span className="ml-2 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">{negsVencidas}</span>}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-52 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Buscar igreja..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {tab === "contas" && (
          <>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filterTri} onChange={(e) => setFilterTri(e.target.value)}>
              <option value="">Todos os trimestres</option>
              {trimestres.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filterSit} onChange={(e) => setFilterSit(e.target.value)}>
              <option value="">Todas situações</option>
              <option value="pendente">Com saldo devedor</option>
              <option value="quitado">Quitado</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </>
        )}
        {tab === "negociacoes" && (
          <>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filterNegStatus} onChange={(e) => setFilterNegStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="aberta">Abertas</option>
              <option value="fechada">Fechadas</option>
              <option value="vencida">Vencidas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            {cc("ebd_negociacoes") && (
              <button onClick={() => { setNegModal("new"); setNegForm({ churchId: "", titulo: "", descricao: "", valorTotal: 0, numParcelas: 1, dataInicio: new Date().toISOString().slice(0, 10), dataVencimento: "", observacao: "" }); setParcelas([]); }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors ml-auto">
                <Plus className="w-4 h-4" /> Nova Negociação
              </button>
            )}
          </>
        )}
      </div>

      {/* ── TAB CONTAS ── */}
      {tab === "contas" && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-slate-400 text-center py-10">Nenhum registro financeiro</p>
          ) : filtered.map((row) => (
            <div key={row.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${Number(row.saldo) > 0 ? "border-orange-200" : "border-slate-200"}`}>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{row.church.name}</p>
                    {Number(row.saldo) > 0 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                  </div>
                  {row.trimestre && <p className="text-xs text-slate-400">{row.trimestre.nome}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-xl font-bold ${Number(row.saldo) > 0 ? "text-orange-700" : "text-green-700"}`}>
                      R$ {fmt(Number(row.saldo))}
                    </p>
                    <p className="text-xs text-slate-400">{row.movimentos.length} movimentos</p>
                  </div>
                  {expandedId === row.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {expandedId === row.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
                  <div className="space-y-2">
                    {row.movimentos.length === 0 ? (
                      <p className="text-slate-400 text-sm">Sem movimentos</p>
                    ) : row.movimentos.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-slate-700">{TIPO_MOV_LABEL[m.tipo] || m.tipo}</span>
                          {m.descricao && <span className="text-slate-500 ml-1">— {m.descricao}</span>}
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${TIPO_MOV_COLOR[m.tipo] || ""}`}>
                            {["pagamento", "credito", "desconto"].includes(m.tipo) ? "–" : "+"} R$ {fmt(m.valor)}
                          </p>
                          <p className="text-xs text-slate-400">{new Date(m.data).toLocaleDateString("pt-BR")} · Saldo: R$ {fmt(m.saldoDepois)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => openAjusteModal(row, "pagamento")}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100">
                      <TrendingDown className="w-3 h-3" /> Registrar Pagamento
                    </button>
                    <button onClick={() => openAjusteModal(row, "desconto")}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100">
                      <TrendingUp className="w-3 h-3" /> Ajuste / Desconto
                    </button>
                    {Number(row.saldo) > 0 && cv("ebd_negociacoes") && cc("ebd_negociacoes") && (
                      <button onClick={() => { setTab("negociacoes"); setNegModal("new"); setNegForm((p) => ({ ...p, churchId: row.church.id, valorTotal: Number(row.saldo) })); }}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100">
                        <Handshake className="w-3 h-3" /> Negociar Dívida
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB NEGOCIAÇÕES ── */}
      {tab === "negociacoes" && (
        <div className="space-y-3">
          {filteredNegs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Handshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma negociação registrada</p>
              <p className="text-xs mt-1">Use "Nova Negociação" para registrar acordos de dívida com igrejas</p>
            </div>
          ) : filteredNegs.map((neg) => {
            const parcelasVencidas = neg.parcelas.filter((p) => p.status === "vencido" || (p.status === "pendente" && new Date(p.dataVencimento) < new Date())).length;
            const parcelasPagas = neg.parcelas.filter((p) => p.status === "pago").length;
            return (
              <div key={neg.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${neg.status === "vencida" ? "border-red-200" : neg.status === "fechada" ? "border-green-200" : "border-slate-200"}`}>
                <div className="p-4 flex items-start justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === neg.id ? null : neg.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{neg.church.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NEG_STATUS[neg.status]?.cls || "bg-slate-100 text-slate-600"}`}>
                        {NEG_STATUS[neg.status]?.label || neg.status}
                      </span>
                      {parcelasVencidas > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          {parcelasVencidas} parcela(s) vencida(s)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{neg.titulo}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {neg.numParcelas}x · Início: {new Date(neg.dataInicio).toLocaleDateString("pt-BR")}
                      {neg.dataVencimento && ` · Vence: ${new Date(neg.dataVencimento).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">R$ {fmt(Number(neg.valorTotal))}</p>
                      <p className="text-xs text-slate-400">{parcelasPagas}/{neg.numParcelas} parcelas pagas</p>
                    </div>
                    {expandedId === neg.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {expandedId === neg.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
                    {neg.descricao && <p className="text-sm text-slate-600">{neg.descricao}</p>}
                    {neg.parcelas.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parcelas</h4>
                        <div className="space-y-2">
                          {neg.parcelas.map((p) => {
                            const vencida = p.status === "pendente" && new Date(p.dataVencimento) < new Date();
                            return (
                              <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-semibold text-slate-500 w-6">#{p.numParcela}</span>
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">R$ {fmt(Number(p.valor))}</p>
                                    <p className="text-xs text-slate-400">
                                      Vence: {new Date(p.dataVencimento).toLocaleDateString("pt-BR")}
                                      {p.dataPagamento && ` · Pago: ${new Date(p.dataPagamento).toLocaleDateString("pt-BR")}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${vencida ? "bg-red-100 text-red-700" : PARC_STATUS[p.status]?.cls || "bg-slate-100 text-slate-600"}`}>
                                    {vencida ? "Vencida" : PARC_STATUS[p.status]?.label || p.status}
                                  </span>
                                  {(p.status === "pendente" || vencida) && neg.status !== "cancelada" && ce("ebd_negociacoes") && (
                                    <button onClick={() => pagarParcela(neg.id, p.id)} disabled={payingParcelaId === p.id}
                                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-60">
                                      {payingParcelaId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Pagar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {neg.status !== "fechada" && neg.status !== "cancelada" && cd("ebd_negociacoes") && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => cancelarNegociacao(neg.id)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                          <X className="w-3 h-3" /> Cancelar acordo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL AJUSTE FINANCEIRO ── */}
      {ajusteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Registrar Pagamento</h2>
                <p className="text-sm text-slate-500 mt-0.5">{ajusteModal.churchName}</p>
              </div>
              <button onClick={() => { setAjusteModal(null); setChurchDebt(null); setSelectedParcela(null); }} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-abas do modal */}
            <div className="flex gap-1 border-b border-slate-200">
              {([["trimestre", "Pagamento de Trimestre"], ["negociacao", "Pagamento de Negociação"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setAjusteModal((p) => p ? { ...p, modalTab: k } : p); setSelectedParcela(null); }}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${ajusteModal.modalTab === k ? "border-orange-500 text-orange-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Resumo dívida acumulada */}
            {loadingDebt ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...</div>
            ) : churchDebt && churchDebt.totalAcumulado > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Situação financeira</p>
                {churchDebt.rows.filter((r) => Number(r.saldo) > 0).map((r) => (
                  <div key={r.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">{r.trimestre?.nome || "Geral"}</span>
                    <span className="font-semibold text-orange-700">R$ {fmt(Number(r.saldo))}</span>
                  </div>
                ))}
                <div className="border-t border-orange-200 pt-1.5 flex justify-between font-bold text-sm">
                  <span className="text-orange-800">Total acumulado:</span>
                  <span className="text-orange-900">R$ {fmt(churchDebt.totalAcumulado)}</span>
                </div>
              </div>
            )}

            {/* ── ABA TRIMESTRE ── */}
            {ajusteModal.modalTab === "trimestre" && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Trimestre</label>
                  <select className={inputCls} value={ajusteModal.trimestreId}
                    onChange={(e) => setAjusteModal((p) => p ? { ...p, trimestreId: e.target.value } : p)}>
                    <option value="">Sem trimestre (geral)</option>
                    {trimestres.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo *</label>
                  <select className={inputCls} value={ajusteModal.tipo}
                    onChange={(e) => setAjusteModal((p) => p ? { ...p, tipo: e.target.value } : p)}>
                    {TIPO_MOV.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Valor (R$) *</label>
                  <input type="number" step="0.01" className={inputCls} value={ajusteModal.valor}
                    onChange={(e) => setAjusteModal((p) => p ? { ...p, valor: Number(e.target.value) } : p)} />
                </div>
                <div>
                  <label className={labelCls}>Data *</label>
                  <input type="date" className={inputCls} value={ajusteModal.data}
                    onChange={(e) => setAjusteModal((p) => p ? { ...p, data: e.target.value } : p)} />
                </div>
                <div>
                  <label className={labelCls}>Descrição</label>
                  <input className={inputCls} value={ajusteModal.descricao}
                    onChange={(e) => setAjusteModal((p) => p ? { ...p, descricao: e.target.value } : p)} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveAjuste} disabled={loading || !ajusteModal.valor}
                    className="flex items-center gap-2 flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 justify-center disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                  </button>
                  <button onClick={() => { setAjusteModal(null); setChurchDebt(null); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* ── ABA NEGOCIAÇÃO ── */}
            {ajusteModal.modalTab === "negociacao" && (
              <div className="space-y-3">
                {loadingDebt ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                ) : (() => {
                  const parcelasPendentes = (churchDebt?.negociacoes || [])
                    .filter((n) => n.status === "aberta" || n.status === "vencida")
                    .flatMap((n) => n.parcelas
                      .filter((p) => p.status !== "pago" && p.status !== "cancelado")
                      .map((p) => ({ neg: n, parcela: p }))
                    );
                  if (parcelasPendentes.length === 0) return (
                    <div className="text-center py-6 text-slate-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma parcela pendente de negociação</p>
                    </div>
                  );
                  return (
                    <>
                      <p className="text-xs text-slate-500">Selecione a parcela que está sendo paga:</p>
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {parcelasPendentes.map(({ neg, parcela }) => {
                          const isSelected = selectedParcela?.parcelaId === parcela.id;
                          const vencida = parcela.status === "pendente" && new Date(parcela.dataVencimento) < new Date();
                          const statusCls = vencida ? "bg-red-100 text-red-700" : PARC_STATUS[parcela.status]?.cls || "bg-yellow-100 text-yellow-700";
                          const statusLabel = vencida ? "Vencida" : PARC_STATUS[parcela.status]?.label || parcela.status;
                          return (
                            <button key={parcela.id} onClick={() => setSelectedParcela({ negId: neg.id, parcelaId: parcela.id, valor: Number(parcela.valor), label: `${neg.titulo} — Parcela ${parcela.numParcela}/${neg.numParcelas}` })}
                              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${isSelected ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{neg.titulo}</p>
                                  <p className="text-xs text-slate-500">Parcela {parcela.numParcela}/{neg.numParcelas} · Vence: {new Date(parcela.dataVencimento).toLocaleDateString("pt-BR")}</p>
                                </div>
                                <div className="text-right ml-3">
                                  <p className="text-sm font-bold text-slate-800">R$ {fmt(Number(parcela.valor))}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedParcela && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-orange-700 mb-1">Parcela selecionada</p>
                          <p className="text-sm text-slate-700">{selectedParcela.label}</p>
                          <p className="text-lg font-bold text-orange-800 mt-1">R$ {fmt(selectedParcela.valor)}</p>
                        </div>
                      )}

                      <div>
                        <label className={labelCls}>Data do pagamento *</label>
                        <input type="date" className={inputCls} value={ajusteModal.data}
                          onChange={(e) => setAjusteModal((p) => p ? { ...p, data: e.target.value } : p)} />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={saveParcelaNeg} disabled={savingParcela || !selectedParcela}
                          className="flex items-center gap-2 flex-1 px-4 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-800 justify-center disabled:opacity-50">
                          {savingParcela ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Confirmar Pagamento da Parcela
                        </button>
                        <button onClick={() => { setAjusteModal(null); setChurchDebt(null); setSelectedParcela(null); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                          Cancelar
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL NOVA NEGOCIAÇÃO ── */}
      {negModal === "new" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Nova Negociação / Acordo</h2>
              <button onClick={() => setNegModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Igreja *</label>
                <select className={inputCls} value={negForm.churchId}
                  onChange={(e) => setNegForm((p) => ({ ...p, churchId: e.target.value }))}>
                  <option value="">Selecione a igreja</option>
                  {[...new Map(rows.map((r) => [r.church.id, r.church])).values()].map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Título do acordo *</label>
                <input className={inputCls} placeholder="Ex: Parcelamento dívida 1º trimestre 2026"
                  value={negForm.titulo} onChange={(e) => setNegForm((p) => ({ ...p, titulo: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Valor Total (R$) *</label>
                <input type="number" step="0.01" className={inputCls} value={negForm.valorTotal}
                  onChange={(e) => { setNegForm((p) => ({ ...p, valorTotal: Number(e.target.value) })); gerarParcelas(negForm.numParcelas, Number(e.target.value), negForm.dataInicio); }} />
              </div>
              <div>
                <label className={labelCls}>Número de parcelas</label>
                <input type="number" min={1} max={60} className={inputCls} value={negForm.numParcelas}
                  onChange={(e) => { setNegForm((p) => ({ ...p, numParcelas: Number(e.target.value) })); gerarParcelas(Number(e.target.value), negForm.valorTotal, negForm.dataInicio); }} />
              </div>
              <div>
                <label className={labelCls}>Data de início</label>
                <input type="date" className={inputCls} value={negForm.dataInicio}
                  onChange={(e) => { setNegForm((p) => ({ ...p, dataInicio: e.target.value })); gerarParcelas(negForm.numParcelas, negForm.valorTotal, e.target.value); }} />
              </div>
              <div>
                <label className={labelCls}>Vencimento do acordo</label>
                <input type="date" className={inputCls} value={negForm.dataVencimento}
                  onChange={(e) => setNegForm((p) => ({ ...p, dataVencimento: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição / Termos</label>
                <textarea className={inputCls} rows={2} value={negForm.descricao}
                  onChange={(e) => setNegForm((p) => ({ ...p, descricao: e.target.value }))} />
              </div>
            </div>

            {parcelas.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Parcelas geradas automaticamente
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {parcelas.map((p, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 items-center bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-xs text-slate-500">Parcela {p.numParcela}</span>
                      <input type="number" step="0.01" className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none"
                        value={p.valor}
                        onChange={(e) => { const ps = [...parcelas]; ps[i] = { ...ps[i], valor: Number(e.target.value) }; setParcelas(ps); }} />
                      <input type="date" className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none"
                        value={p.dataVencimento}
                        onChange={(e) => { const ps = [...parcelas]; ps[i] = { ...ps[i], dataVencimento: e.target.value }; setParcelas(ps); }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={saveNegociacao} disabled={savingNeg || !negForm.churchId || !negForm.titulo}
                className="flex items-center gap-2 flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 justify-center disabled:opacity-50">
                {savingNeg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Negociação
              </button>
              <button onClick={() => setNegModal(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDlg}
        title={confirmDlg?.title || ""}
        message={confirmDlg?.message}
        variant={confirmDlg?.variant || "danger"}
        confirmLabel={confirmDlg?.confirmLabel}
        onConfirm={() => confirmDlg?.onConfirm()}
        onCancel={() => setConfirmDlg(null)}
      />
      <AlertDialog
        open={!!alertDlg}
        title={alertDlg?.title || ""}
        message={alertDlg?.message}
        variant="danger"
        onClose={() => setAlertDlg(null)}
      />
    </div>
  );
}
