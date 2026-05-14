import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Database,
  Download,
  FileText,
  Filter,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiBase } from "../../../lib/apiBase";

interface BackupEntry {
  id: string;
  filename: string;
  date: string;
  size: string;
  type: string;
  status: string;
  duration: string;
  cloudPath?: string;
}

interface BackupStats {
  total: number;
  totalSizeGB: string;
  lastBackupAge: string;
  nextBackup: string;
}

interface CloudBackup {
  name: string;
  path: string;
  size: string;
  date: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("mrm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function Backup() {
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTab, setRestoreTab] = useState<"local" | "cloud">("local");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cloudList, setCloudList] = useState<CloudBackup[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [selectedCloud, setSelectedCloud] = useState<CloudBackup | null>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem("bk_auto") !== "false");
  const [frequency, setFrequency] = useState(() => localStorage.getItem("bk_freq") || "Diario");
  const [time, setTime] = useState(() => localStorage.getItem("bk_time") || "03:00");
  const [retention, setRetention] = useState(() => localStorage.getItem("bk_ret") || "30");
  const [notify, setNotify] = useState(() => localStorage.getItem("bk_notify") !== "false");
  const [cloudStorage, setCloudStorage] = useState(() => localStorage.getItem("bk_cloud") === "true");

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const filtered = entries.filter((e) => {
    const d = new Date(e.date);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setPage(1); }, [dateFrom, dateTo, pageSize]);

  async function load() {
    setLoadingList(true);
    try {
      const headers = authHeaders();
      const [listRes, statsRes] = await Promise.all([
        fetch(`${apiBase}/backup/list`, { headers }),
        fetch(`${apiBase}/backup/stats`, { headers }),
      ]);
      if (listRes.ok) setEntries(await listRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      showMessage("error", "Erro ao carregar backups.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/backup/create`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true, cloudStorage }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("success", cloudStorage && data.cloudPath ? "Backup criado e enviado para o Supabase!" : "Backup criado com sucesso!");
        load();
      } else {
        showMessage("error", data.error || "Erro ao criar backup.");
      }
    } catch {
      showMessage("error", "Erro de conexao ao criar backup.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(entry: BackupEntry) {
    try {
      const res = await fetch(`${apiBase}/backup/download/${entry.filename}`, { headers: authHeaders() });
      if (!res.ok) { showMessage("error", "Erro ao baixar arquivo."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = entry.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showMessage("error", "Erro ao baixar backup.");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      const res = await fetch(`${apiBase}/backup/${deleteTarget.filename}`, { method: "DELETE", headers: authHeaders() });
      if (res.ok) { showMessage("success", "Backup excluido com sucesso."); load(); }
      else { const d = await res.json(); showMessage("error", d.error || "Erro ao excluir."); }
    } catch {
      showMessage("error", "Erro de conexao ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  async function openRestoreModal() {
    setSelectedFile(null); setSelectedCloud(null); setRestoreTab("local"); setRestoreOpen(true);
    loadCloudList();
  }

  async function loadCloudList() {
    setLoadingCloud(true);
    try {
      const res = await fetch(`${apiBase}/backup/cloud-list`, { headers: authHeaders() });
      setCloudList(res.ok ? await res.json() : []);
    } catch { setCloudList([]); }
    finally { setLoadingCloud(false); }
  }

  async function handleRestoreLocal() {
    if (!selectedFile) return;
    setRestoreOpen(false); setRestoring(true); setRestoreResult(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch(`${apiBase}/backup/restore`, { method: "POST", headers: authHeaders(), body: form });
      const data = await res.json();
      if (res.ok) { setRestoreResult({ ok: true, text: `Restauracao concluida! ${data.statements ?? ""} comandos executados.` }); load(); }
      else setRestoreResult({ ok: false, text: data.error || "Erro na restauracao." });
    } catch { setRestoreResult({ ok: false, text: "Erro de conexao durante a restauracao." }); }
    finally { setRestoring(false); }
  }

  async function handleRestoreCloud() {
    if (!selectedCloud) return;
    setRestoreOpen(false); setRestoring(true); setRestoreResult(null);
    try {
      const res = await fetch(`${apiBase}/backup/restore-cloud`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedCloud.path }),
      });
      const data = await res.json();
      if (res.ok) { setRestoreResult({ ok: true, text: `Restauracao concluida! ${data.statements ?? ""} comandos executados.` }); load(); }
      else setRestoreResult({ ok: false, text: data.error || "Erro na restauracao." });
    } catch { setRestoreResult({ ok: false, text: "Erro de conexao durante a restauracao." }); }
    finally { setRestoring(false); }
  }

  function handleSaveSettings() {
    localStorage.setItem("bk_auto", String(autoBackup));
    localStorage.setItem("bk_freq", frequency);
    localStorage.setItem("bk_time", time);
    localStorage.setItem("bk_ret", retention);
    localStorage.setItem("bk_notify", String(notify));
    localStorage.setItem("bk_cloud", String(cloudStorage));
    showMessage("success", "Configuracoes salvas.");
  }

  const isInterval = frequency.startsWith("A cada");

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="p-6 space-y-6">
      {message && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${message.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {message.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <CheckCircle className="w-6 h-6 text-green-600" />, bg: "bg-green-100", label: "Ultimo Backup", value: stats?.lastBackupAge ?? "..." },
          { icon: <Database className="w-6 h-6 text-blue-600" />, bg: "bg-blue-100", label: "Total de Backups", value: String(stats?.total ?? "...") },
          { icon: <HardDrive className="w-6 h-6 text-purple-600" />, bg: "bg-purple-100", label: "Tamanho Total", value: stats ? `${stats.totalSizeGB}GB` : "..." },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center shrink-0`}>{c.icon}</div>
            <div><p className="text-xs text-slate-500 font-medium">{c.label}</p><p className="text-2xl font-bold text-slate-800">{c.value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Historico de Backups</h2>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loadingList} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                {loadingList ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
              <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {creating ? "Criando..." : "Criar Backup Manual"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 mb-4 text-sm text-slate-600">
            <Upload size={15} className="text-slate-400" />
            <span>Restaurar a partir de arquivo .sql:</span>
            <button onClick={openRestoreModal} className="text-purple-600 font-medium hover:underline">Escolher arquivo</button>
            <span className="text-slate-400 text-xs">ou restaurar da nuvem</span>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-slate-600 font-medium"><Filter size={14} className="text-slate-400" /> Filtrar por periodo:</span>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <span className="text-slate-400 text-xs">ate</span>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <X size={12} /> Limpar
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-8 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center gap-1"><Calendar size={13} />Data</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center gap-1"><HardDrive size={13} />Tamanho</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center gap-1"><Clock size={13} />Duracao</span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Armazenamento</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingList && entries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10"><Loader2 size={22} className="animate-spin text-purple-500 mx-auto" /></td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Nenhum backup encontrado.</td></tr>
                ) : paged.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3"><CheckCircle size={18} className="text-green-500" /></td>
                    <td className="px-4 py-3 font-medium text-slate-800">{entry.type}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" />{formatDate(entry.date)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1.5"><HardDrive size={13} className="text-slate-400" />{entry.size}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />{entry.duration || "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                          <HardDrive size={10} /> Local
                        </span>
                        {entry.cloudPath && (
                          <span className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                            <Cloud size={10} /> Supabase
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">{entry.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleDownload(entry)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Download"><Download size={15} /></button>
                        <button onClick={openRestoreModal} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-purple-600" title="Restaurar"><Upload size={15} /></button>
                        <button onClick={() => setDeleteTarget(entry)} disabled={deletingId === entry.id} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 disabled:opacity-50" title="Excluir">
                          {deletingId === entry.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>Exibir</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>por pagina</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 mr-2">
                {filtered.length === 0 ? "0" : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)}`} de {filtered.length}
              </span>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="px-1 text-slate-400 text-xs">...</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)} className={`w-7 h-7 rounded text-xs font-medium ${safePage === p ? "bg-purple-600 text-white" : "hover:bg-slate-100 text-slate-600"}`}>{p}</button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Configuracoes de Backup</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 font-medium">Backup Automatico</span>
            <button onClick={() => setAutoBackup((v) => !v)} className={`relative w-10 h-5 rounded-full transition-colors ${autoBackup ? "bg-purple-600" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${autoBackup ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Frequencia</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
              <option>Diario</option><option>Semanal</option><option>Mensal</option>
              <option>A cada 6 horas</option><option>A cada 12 horas</option>
            </select>
          </div>
          {!isInterval && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Clock size={12} /> Horario</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Retencao (dias)</label>
            <input type="number" value={retention} onChange={(e) => setRetention(e.target.value)} min={1} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            <p className="text-xs text-slate-400 mt-1">Backups mais antigos serao removidos automaticamente.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-purple-600" />
            Notificar apos backup
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input type="checkbox" checked={cloudStorage} onChange={(e) => setCloudStorage(e.target.checked)} className="accent-purple-600" />
            Enviar para cloud storage
          </label>
          {cloudStorage && (
            <p className="text-xs text-blue-600 flex items-center gap-1 -mt-2"><Cloud size={11} /> Bucket Supabase: dados/backups/</p>
          )}
          <button onClick={handleSaveSettings} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 rounded-lg">
            <Save size={14} /> Salvar Configuracoes
          </button>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 space-y-1">
            <p className="font-semibold flex items-center gap-1"><AlertTriangle size={12} /> Importante</p>
            <p>Mantenha backups regulares dos dados</p>
            <p>Teste restauracoes periodicamente</p>
            <p>Armazene copias em local seguro</p>
            <p>Nunca delete o backup mais recente</p>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><Trash2 size={20} className="text-red-600" /></div>
              <div><h3 className="font-semibold text-slate-900">Excluir Backup</h3><p className="text-xs text-slate-500">Esta acao nao pode ser desfeita.</p></div>
            </div>
            <p className="text-sm text-slate-700">Tem certeza que deseja excluir <span className="font-medium break-all">{deleteTarget.filename}</span>?</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {restoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Restaurar Backup</h3>
              <button onClick={() => setRestoreOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="flex border-b border-slate-100">
              <button onClick={() => setRestoreTab("local")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${restoreTab === "local" ? "text-purple-700 border-b-2 border-purple-600" : "text-slate-500 hover:text-slate-700"}`}>
                <FileText size={15} /> Arquivo Local
              </button>
              <button onClick={() => { setRestoreTab("cloud"); loadCloudList(); }} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${restoreTab === "cloud" ? "text-purple-700 border-b-2 border-purple-600" : "text-slate-500 hover:text-slate-700"}`}>
                <Cloud size={15} /> Supabase Cloud
              </button>
            </div>
            <div className="p-6 space-y-4">
              {restoreTab === "local" ? (
                <>
                  <p className="text-sm text-slate-600">Selecione um arquivo <code>.sql</code> gerado por este sistema.</p>
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors" onClick={() => restoreFileRef.current?.click()}>
                    <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                    {selectedFile ? <p className="text-sm font-medium text-purple-700">{selectedFile.name}</p> : (
                      <><p className="text-sm text-slate-500">Clique para selecionar</p><p className="text-xs text-slate-400 mt-1">Apenas arquivos .sql</p></>
                    )}
                  </div>
                  <input ref={restoreFileRef} type="file" accept=".sql" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                    <AlertTriangle size={12} className="inline mr-1" /> A restauracao substituira os dados atuais.
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setRestoreOpen(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
                    <button onClick={handleRestoreLocal} disabled={!selectedFile} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">Restaurar</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600">Selecione um backup salvo no Supabase Storage.</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {loadingCloud ? (
                      <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-purple-500" /></div>
                    ) : cloudList.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-8">Nenhum backup na nuvem encontrado.</p>
                    ) : cloudList.map((cb) => (
                      <button key={cb.path} onClick={() => setSelectedCloud(cb)} className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-0 hover:bg-purple-50 transition-colors ${selectedCloud?.path === cb.path ? "bg-purple-50 border-l-2 border-l-purple-600" : ""}`}>
                        <Cloud size={16} className="text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{cb.name}</p>
                          <p className="text-xs text-slate-400">{cb.size} - {cb.date}</p>
                        </div>
                        {selectedCloud?.path === cb.path && <CheckCircle size={15} className="text-purple-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                    <AlertTriangle size={12} className="inline mr-1" /> A restauracao substituira os dados atuais.
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setRestoreOpen(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
                    <button onClick={handleRestoreCloud} disabled={!selectedCloud} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">Restaurar da Nuvem</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {restoring && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm mx-4 text-center">
            <Loader2 size={48} className="animate-spin text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-900">Restaurando o sistema...</h3>
            <p className="text-sm text-slate-500">Por favor, <strong>nao feche esta janela</strong> nem execute outras acoes.</p>
          </div>
        </div>
      )}

      {restoreResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4 text-center">
            {restoreResult.ok ? <CheckCircle size={48} className="text-green-500" /> : <AlertTriangle size={48} className="text-red-500" />}
            <h3 className={`text-lg font-semibold ${restoreResult.ok ? "text-green-700" : "text-red-700"}`}>
              {restoreResult.ok ? "Restauracao Concluida!" : "Erro na Restauracao"}
            </h3>
            <p className="text-sm text-slate-600">{restoreResult.text}</p>
            <button onClick={() => setRestoreResult(null)} className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}