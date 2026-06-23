import React, { useState, useEffect } from "react";
import {
  Calendar,
  Ticket,
  Printer,
  Trash2,
  Search,
  X,
  Check,
  RefreshCw,
  Barcode,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { ConfirmationModal } from "../../design-system/components/Modal";

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface TicketRecord {
  id: string;
  campoId: string;
  churchId: string | null;
  churchName: string | null;
  regionalName: string | null;
  dataCulto: string;
  ticketCode: string | null;
  membroRol: string | null;
  createdAt: string;
}

interface ChurchOption {
  id: string;
  name: string;
  regionalId: string;
  regional?: {
    id: string;
    name: string;
    code: string;
  };
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("mrm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    // Treat date as UTC to avoid local timezone offset shifts
    const dt = new Date(d);
    const day = String(dt.getUTCDate()).padStart(2, "0");
    const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return d;
  }
}

export default function TicketPresencePage() {
  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // State
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // User & Search context
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchChurchTerm, setSearchChurchTerm] = useState("");
  const [showChurchDropdown, setShowChurchDropdown] = useState(false);

  // Filters (Image 2)
  const [filterChurchId, setFilterChurchId] = useState("");
  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State (Image 1)
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedChurch, setSelectedChurch] = useState<ChurchOption | null>(null);
  const [showModalDropdown, setShowModalDropdown] = useState(false);
  const [modalDate, setModalDate] = useState(getTodayStr());
  const [modalQty, setModalQty] = useState(10);
  const [modalPage, setModalPage] = useState(1);
  const modalPageSize = 4; // Compact list to fit standard popup height

  // Toast
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const isRestricted = !!(
    (currentUser?.profileType === "church" && currentUser?.churchId) || 
    (currentUser?.churchId && (
      String(currentUser?.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("secret") || 
      String(currentUser?.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("tesour")
    ))
  );

  // Load Churches for filters and selector
  async function loadChurches(currentChurchId?: string) {
    try {
      const res = await fetch(`${apiBase}/churches`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setChurches(data);
        const activeId = currentChurchId || filterChurchId;
        if (activeId) {
          const selected = data.find((c: any) => c.id === activeId);
          if (selected) {
            setSearchChurchTerm(selected.name);
          }
        }
      }
    } catch (e) {
      console.error("Error loading churches:", e);
    }
  }

  // Load Tickets
  async function loadTickets(overrideChurchId?: string) {
    setLoading(true);
    setSelectedTicketIds([]);
    try {
      const params = new URLSearchParams();
      const activeChurchId = typeof overrideChurchId === "string" ? overrideChurchId : filterChurchId;
      if (activeChurchId) params.set("church_id", activeChurchId);
      if (filterDate) params.set("data_inicial", filterDate);

      const res = await fetch(`${apiBase}/presence-tickets?${params}`, { headers: authHeaders() });
      if (res.ok) {
        setTickets(await res.json());
      } else {
        showToast(false, "Erro ao carregar os tíquetes.");
      }
    } catch {
      showToast(false, "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  // Handle ticket creation submission
  async function handleCreateTickets(e: React.FormEvent) {
    e.preventDefault();
    if (!modalDate) {
      showToast(false, "Por favor, informe a data do culto.");
      return;
    }
    if (modalQty <= 0) {
      showToast(false, "Quantidade de tíquetes deve ser maior que 0.");
      return;
    }

    const churchToUse = isRestricted ? currentUser?.churchId : selectedChurch?.id;

    setGenerating(true);
    try {
      const res = await fetch(`${apiBase}/presence-tickets`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          churchId: churchToUse || null,
          dataCulto: modalDate,
          quantidade: modalQty,
        }),
      });

      if (res.ok) {
        showToast(true, `${modalQty} Tíquetes gerados com sucesso.`);
        setShowModal(false);
        if (!isRestricted) {
          setSelectedChurch(null);
        }
        setModalDate(getTodayStr());
        setModalQty(10);
        setModalSearch("");
        loadTickets();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(false, err.error || "Erro ao gerar os tíquetes.");
      }
    } catch {
      showToast(false, "Erro de conexão.");
    } finally {
      setGenerating(false);
    }
  }

  // Individual delete executor
  async function executeDeleteTicket(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`${apiBase}/presence-tickets/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        showToast(true, "Tíquete excluído com sucesso.");
        setDeleteModalConfig(null);
        loadTickets();
      } else {
        showToast(false, "Erro ao excluir o tíquete.");
      }
    } catch {
      showToast(false, "Erro de conexão.");
    } finally {
      setDeletingId(null);
    }
  }

  // Trigger individual delete modal
  function handleDeleteTicket(id: string) {
    setDeleteModalConfig({
      isOpen: true,
      title: "Excluir Tíquete",
      message: "Deseja realmente excluir este tíquete de presença?",
      onConfirm: () => executeDeleteTicket(id),
    });
  }

  // Bulk delete executor
  async function handleBulkDelete() {
    if (selectedTicketIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/presence-tickets`, {
        method: "DELETE",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTicketIds }),
      });
      if (res.ok) {
        showToast(true, `${selectedTicketIds.length} Tíquetes excluídos com sucesso.`);
        setSelectedTicketIds([]);
        setDeleteModalConfig(null);
        loadTickets();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(false, err.error || "Erro ao excluir os tíquetes.");
        setDeleteModalConfig(null);
        setLoading(false);
      }
    } catch {
      showToast(false, "Erro de conexão.");
      setDeleteModalConfig(null);
      setLoading(false);
    }
  }

  // Reset Filters
  function handleResetFilters() {
    const initialChurchId = isRestricted && currentUser?.churchId ? currentUser.churchId : "";
    setFilterChurchId(initialChurchId);
    if (initialChurchId) {
      const selected = churches.find(c => c.id === initialChurchId);
      setSearchChurchTerm(selected ? selected.name : "");
    } else {
      setSearchChurchTerm("");
    }
    setFilterDate(getTodayStr());
    setCurrentPage(1);
    setTimeout(() => loadTickets(initialChurchId), 50);
  }

  useEffect(() => {
    let initialChurchId = "";
    try {
      const stored = localStorage.getItem("mrm_user");
      if (stored) {
        const u = JSON.parse(stored);
        setCurrentUser(u);
        
        const restricted = u.profileType === "church" || 
          String(u.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("secret") || 
          String(u.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("tesour");
          
        if (restricted && u.churchId) {
          initialChurchId = u.churchId;
          setFilterChurchId(u.churchId);
        }
      }
    } catch (e) {
      console.error("Error loading user context:", e);
    }
    loadChurches(initialChurchId);
    loadTickets(initialChurchId);

    // Click outside listener to close dropdowns
    function handleClickOutside(event: MouseEvent) {
      const filterEl = document.getElementById("church-filter-dropdown");
      const modalEl = document.getElementById("modal-church-dropdown");

      if (filterEl && !filterEl.contains(event.target as Node)) {
        setShowChurchDropdown(false);
      }
      if (modalEl && !modalEl.contains(event.target as Node)) {
        setShowModalDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  // Filtered churches in modal selector
  const filteredChurchesModal = churches.filter((c) => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.regional?.name || "").toLowerCase().includes(q) ||
      (c.regional?.code || "").toLowerCase().includes(q)
    );
  });

  // Modal selector pagination
  const modalTotalPages = Math.ceil(filteredChurchesModal.length / modalPageSize) || 1;
  const modalPageChurches = filteredChurchesModal.slice(
    (modalPage - 1) * modalPageSize,
    modalPage * modalPageSize
  );

  // Main table pagination
  const paginatedTickets = tickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(tickets.length / pageSize) || 1;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${
            toast.ok ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.ok ? <Check size={18} /> : <X size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Styles for print output (3 column cutting grid) */}
      <style>{`
        @media print {
          /* Hide app shell and normal content */
          body * {
            visibility: hidden;
            background: transparent !important;
          }
          /* Show print elements only */
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          .ticket-card {
            border: 2px dashed #94a3b8 !important;
            border-radius: 12px !important;
            padding: 16px !important;
            background: white !important;
            color: black !important;
            page-break-inside: avoid;
            height: 140px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .ticket-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Header Section with Gerar Ticket Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tickets criados</h1>
          <p className="text-slate-500 text-sm">Gerencie e imprima tíquetes de presença</p>
        </div>
        <button
          onClick={() => {
            setModalDate(getTodayStr());
            if (isRestricted && currentUser?.churchId) {
              const userChurch = churches.find(c => c.id === currentUser.churchId);
              if (userChurch) {
                setSelectedChurch(userChurch);
              }
            } else {
              setSelectedChurch(null);
            }
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-[0.98]"
        >
          <Ticket className="w-4 h-4" />
          Gerar Ticket
        </button>
      </div>

      <div className="space-y-6">
        {/* Filter Bar (Image 2) */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          {/* Searchable Church Dropdown */}
          <div className="relative min-w-[240px] flex-1 md:flex-none" id="church-filter-dropdown">
            <div className="relative">
              <input
                type="text"
                placeholder={isRestricted ? (churches.find(c => c.id === filterChurchId)?.name || "Sua Igreja") : "Filtrar por Igreja"}
                disabled={isRestricted}
                value={isRestricted ? "" : searchChurchTerm}
                onChange={(e) => {
                  setSearchChurchTerm(e.target.value);
                  setShowChurchDropdown(true);
                }}
                onFocus={() => {
                  if (!isRestricted) {
                    setShowChurchDropdown(true);
                  }
                }}
                className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  isRestricted ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                }`}
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {showChurchDropdown && !isRestricted && (
              <div className="absolute left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto p-1.5">
                <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      setFilterChurchId("");
                      setSearchChurchTerm("");
                      setShowChurchDropdown(false);
                      loadTickets("");
                    }}
                    className="px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-500 font-semibold rounded"
                  >
                    Todas as Igrejas
                  </div>
                  {churches
                    .filter((c) => {
                      if (!searchChurchTerm) return true;
                      const q = searchChurchTerm.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(q) ||
                        (c.regional?.name || "").toLowerCase().includes(q) ||
                        (c.regional?.code || "").toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setFilterChurchId(c.id);
                          setSearchChurchTerm(c.name);
                          setShowChurchDropdown(false);
                          loadTickets(c.id);
                        }}
                        className={`px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 rounded flex items-center justify-between ${
                          filterChurchId === c.id ? "bg-emerald-500/5 font-semibold text-emerald-600 dark:text-emerald-400" : ""
                        }`}
                      >
                        <span>{c.name}</span>
                        {filterChurchId === c.id && <Check size={14} className="text-emerald-500" />}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Date Input */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="Data Inicial"
              className="border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Funnel Clear Button */}
          <button
            onClick={handleResetFilters}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            title="Limpar filtros"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Search Button */}
          <button
            onClick={() => loadTickets()}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ml-auto md:ml-0"
          >
            <Search className="w-4 h-4" />
            Consultar
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={tickets.length === 0}
            className="flex items-center justify-center p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            title="Imprimir tíquetes filtrados"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Bulk Delete Button */}
          {selectedTicketIds.length > 0 && (
            <button
              onClick={() => {
                setDeleteModalConfig({
                  isOpen: true,
                  title: "Excluir Tíquetes",
                  message: `Deseja realmente excluir os ${selectedTicketIds.length} tíquetes selecionados?`,
                  onConfirm: handleBulkDelete,
                });
              }}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ml-auto md:ml-0"
            >
              <Trash2 className="w-4 h-4" />
              Excluir ({selectedTicketIds.length})
            </button>
          )}
        </div>

        {/* Tickets List Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span>Carregando tíquetes de presença...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500">
              Nenhum tíquete de presença encontrado.
            </div>
          ) : (
            <>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-emerald-500 text-white border-b border-slate-200 dark:border-slate-700 font-semibold">
                    <th className="px-4 py-3.5 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={tickets.length > 0 && tickets.every(t => selectedTicketIds.includes(t.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTicketIds(tickets.map(t => t.id));
                          } else {
                            setSelectedTicketIds([]);
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-white dark:bg-slate-800 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3.5">Ref. Data Culto.</th>
                    <th className="px-6 py-3.5">Igreja</th>
                    <th className="px-6 py-3.5">Regional</th>
                    <th className="px-6 py-3.5">Ações</th>
                    <th className="px-6 py-3.5">Código Tíquete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                  {paginatedTickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      <td className="px-4 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTicketIds.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTicketIds(prev => [...prev, t.id]);
                            } else {
                              setSelectedTicketIds(prev => prev.filter(id => id !== t.id));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-white dark:bg-slate-800 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                        {fmtDate(t.dataCulto)}
                      </td>
                      <td className="px-6 py-4">{t.churchName || "—"}</td>
                      <td className="px-6 py-4">{t.regionalName || "—"}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleDeleteTicket(t.id)}
                          disabled={deletingId === t.id}
                          className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-500 transition-all"
                          title="Excluir tíquete"
                        >
                          {deletingId === t.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {t.ticketCode || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table pagination with rows per page limit selector */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="flex items-center gap-4">
                  <span>
                    Mostrando {tickets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
                    {Math.min(currentPage * pageSize, tickets.length)} de {tickets.length} tickets
                  </span>
                  <div className="flex items-center gap-2">
                    <span>Linhas por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                  >
                    Primeira
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Creation Modal (Popup Image 1) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200 dark:border-slate-700 transition-all">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-900/60 px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-bold w-fit">
                  comp_ticket
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                }}
                className="w-8 h-8 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleCreateTickets} className="p-5 space-y-4">
              <div className="space-y-3">
                {!isRestricted && (
                  <>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Busque a Igreja e gere os tíckets
                    </label>

                    <div className="relative mb-3" id="modal-church-dropdown">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={modalSearch}
                          onChange={(e) => {
                            setModalSearch(e.target.value);
                            setShowModalDropdown(true);
                          }}
                          onFocus={() => setShowModalDropdown(true)}
                          placeholder="Consultar por Igreja (deixe vazio para tíquetes em branco)"
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-all"
                        />
                        {selectedChurch && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChurch(null);
                              setModalSearch("");
                            }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                          >
                            <X size={16} />
                          </button>
                        )}
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>

                      {showModalDropdown && (
                        <div className="absolute left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto p-1.5">
                          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto font-sans">
                            <div
                              onClick={() => {
                                setSelectedChurch(null);
                                setModalSearch("");
                                setShowModalDropdown(false);
                              }}
                              className="px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-500 font-semibold rounded"
                            >
                              Sem Igreja (Tíquetes em Branco)
                            </div>
                            {churches
                              .filter((c) => {
                                if (!modalSearch) return true;
                                const q = modalSearch.toLowerCase();
                                return (
                                  c.name.toLowerCase().includes(q) ||
                                  (c.regional?.name || "").toLowerCase().includes(q) ||
                                  (c.regional?.code || "").toLowerCase().includes(q)
                                );
                              })
                              .map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setSelectedChurch(c);
                                    setModalSearch(c.name);
                                    setShowModalDropdown(false);
                                  }}
                                  className={`px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 rounded flex items-center justify-between ${
                                    selectedChurch?.id === c.id ? "bg-emerald-500/5 font-semibold text-emerald-600 dark:text-emerald-400" : ""
                                  }`}
                                >
                                  <span>{c.name} <span className="text-[10px] text-slate-400 font-mono">({c.regional?.code || "—"})</span></span>
                                  {selectedChurch?.id === c.id && <Check size={14} className="text-emerald-500" />}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* IGREJA SELECIONADA CARD */}
                <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-900/10 space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {isRestricted ? "Sua Igreja" : "Igreja Selecionada"}
                  </span>
                  <div className="text-xs font-semibold">
                    <div>
                      <span className="block text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold">
                        Igreja
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-sm">
                        {isRestricted 
                          ? (currentUser?.church?.name || currentUser?.churchName || "—")
                          : (selectedChurch?.name || "—")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inputs fields side-by-side */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    <input
                      type="date"
                      required
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-all"
                      placeholder="Data do culto"
                    />
                  </div>

                  <div className="relative">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000}
                      value={modalQty}
                      onChange={(e) => setModalQty(Number(e.target.value))}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-all"
                      placeholder="Quantidade de tickets"
                    />
                  </div>
                </div>
              </div>

              {/* Generation submit action */}
              <button
                type="submit"
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-4"
              >
                {generating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Barcode className="w-5 h-5" />
                )}
                Gerar Tikets
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteModalConfig && (
        <ConfirmationModal
          isOpen={deleteModalConfig.isOpen}
          title={deleteModalConfig.title}
          message={deleteModalConfig.message}
          onClose={() => setDeleteModalConfig(null)}
          onConfirm={deleteModalConfig.onConfirm}
          variant="danger"
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          isConfirming={deletingId !== null || loading}
        />
      )}

      {/* Hidden print component section */}
      <div id="print-section" className="hidden">
        <div className="ticket-grid">
          {tickets.map((t) => (
            <div key={t.id} className="ticket-card">
              <div className="flex justify-between items-start border-b border-slate-200 pb-1.5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-emerald-600 leading-none">
                    Tíquete de Presença
                  </span>
                  <span className="text-[7px] text-slate-500 tracking-wider font-mono">
                    Ref. {fmtDate(t.dataCulto)}
                  </span>
                </div>
                <span className="text-[7px] font-mono font-bold bg-slate-100 px-1 rounded">
                  {t.ticketCode}
                </span>
              </div>

              <div className="space-y-1 py-2 flex-1 text-[9px]">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500">IGREJA:</span>
                  <span className="text-slate-800 font-bold truncate">
                    {t.churchName || "________________________"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500">REGIONAL:</span>
                  <span className="text-slate-800 font-bold truncate">
                    {t.regionalName || "________________________"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500">Membro ROL:</span>
                  <span className="text-slate-800 font-mono">________________________</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <div className="h-4 w-1/2 flex items-center gap-0.5 bg-slate-50 px-1 border border-slate-100 rounded">
                  <div className="h-3 w-[1px] bg-slate-800"></div>
                  <div className="h-3 w-[2px] bg-slate-800"></div>
                  <div className="h-3 w-[1px] bg-slate-800"></div>
                  <div className="h-3 w-[3px] bg-slate-800"></div>
                  <div className="h-3 w-[1px] bg-slate-800"></div>
                  <div className="h-3 w-[2px] bg-slate-800"></div>
                  <div className="h-3 w-[1px] bg-slate-800"></div>
                  <div className="h-3 w-[2px] bg-slate-800"></div>
                  <div className="h-3 w-[1px] bg-slate-800"></div>
                  <div className="h-3 w-[3px] bg-slate-800"></div>
                </div>
                <span className="text-[6px] text-slate-400 font-mono">AD CAMPINAS</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
