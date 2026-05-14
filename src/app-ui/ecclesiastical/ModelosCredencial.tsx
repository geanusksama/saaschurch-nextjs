import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Edit2,
  Eye,
  Image,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CredentialModel {
  id: number;
  nome: string;
  tipo?: string | null;
  descricao?: string | null;
  ativo: boolean;
  frente?: string | null;
  verso?: string | null;
  largura?: number | string | null;
  altura?: number | string | null;
  largurapg?: number | string | null;
  alturapg?: number | string | null;
  linhaporpg?: number | null;
  colunaporpg?: number | null;
  validademeses?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("mrm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const TIPOS = [
  "Credencial de Membro",
  "Credencial de Cooperador",
  "Credencial de Cooperadora",
  "Credencial de Diacono",
  "Credencial de Diaconisa",
  "Credencial de Presbitero",
  "Credencial de Evangelista",
  "Credencial de Pastor",
  "Credencial de Pastora",
  "Credencial de Missionário",
  "Credencial de Missionária",
  "Carteirinha de Membro",
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ModelosCredencial() {
  const [models, setModels] = useState<CredentialModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialModel | null>(null);
  const [previewModel, setPreviewModel] = useState<CredentialModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CredentialModel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/credential-models`, { headers: authHeaders() });
      if (res.ok) setModels(await res.json());
    } catch {
      showToast(false, "Erro ao carregar modelos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/credential-models/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        showToast(true, "Modelo excluído.");
        setDeleteTarget(null);
        load();
      } else {
        showToast(false, "Erro ao excluir modelo.");
      }
    } catch {
      showToast(false, "Erro de conexão.");
    } finally {
      setDeleting(false);
    }
  }

  const active = models.filter((m) => m.ativo !== false);
  const inactive = models.filter((m) => m.ativo === false);

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
      <div className="flex items-center justify-between text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Modelos de Credencial</h1>
            <p className="text-slate-500 text-sm">Gerencie os modelos de carteirinha para impressão</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Novo Modelo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <CreditCard size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total de Modelos</p>
            <p className="text-xl font-bold text-slate-800">{models.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Ativos</p>
            <p className="text-xl font-bold text-slate-800">{active.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <CreditCard size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Inativos</p>
            <p className="text-xl font-bold text-slate-800">{inactive.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Lista de Modelos</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-purple-500" /></div>
        ) : models.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum modelo cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Cartão (mm)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Página (mm)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Grid</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Front image thumbnail */}
                      <div className="w-12 h-8 rounded border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                        {m.frente ? (
                          <img src={m.frente} alt="frente" className="w-full h-full object-cover" />
                        ) : (
                          <Image size={14} className="text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{m.nome}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.tipo || m.nome}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.largura && m.altura ? `${m.largura} × ${m.altura}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.largurapg && m.alturapg ? `${m.largurapg} × ${m.alturapg}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.linhaporpg && m.colunaporpg ? `${m.linhaporpg}×${m.colunaporpg}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.ativo !== false ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {m.ativo !== false ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setPreviewModel(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Visualizar">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => { setEditing(m); setModalOpen(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-purple-600" title="Editar">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CREATE / EDIT MODAL ─────────────────────────────────────────────── */}
      {modalOpen && (
        <CredentialModelModal
          model={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); showToast(true, editing ? "Modelo atualizado!" : "Modelo cadastrado!"); }}
        />
      )}

      {/* ── DELETE MODAL ────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Excluir Modelo</h3>
                <p className="text-xs text-slate-500">O modelo será desativado.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Deseja excluir o modelo <span className="font-medium">{deleteTarget.nome}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60">
                {deleting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW MODAL ───────────────────────────────────────────────────── */}
      {previewModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{previewModel.nome}</h3>
              <button onClick={() => setPreviewModel(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Frente</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center" style={{ aspectRatio: "85.6/53.98" }}>
                  {previewModel.frente ? (
                    <img src={previewModel.frente} alt="frente" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 py-8"><Image size={32} /><span className="text-xs mt-1">Sem imagem</span></div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Verso</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center" style={{ aspectRatio: "85.6/53.98" }}>
                  {previewModel.verso ? (
                    <img src={previewModel.verso} alt="verso" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 py-8"><Image size={32} /><span className="text-xs mt-1">Sem imagem</span></div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-500">Cartão</p><p className="font-semibold">{previewModel.largura ?? "–"} × {previewModel.altura ?? "–"} mm</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-500">Página</p><p className="font-semibold">{previewModel.largurapg ?? "–"} × {previewModel.alturapg ?? "–"} mm</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-500">Grid</p><p className="font-semibold">{previewModel.linhaporpg ?? "–"} × {previewModel.colunaporpg ?? "–"}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function CredentialModelModal({
  model,
  onClose,
  onSaved,
}: {
  model: CredentialModel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !model;
  const [nome, setNome] = useState(model?.nome || "");
  const [tipo, setTipo] = useState(model?.tipo || "");
  const [descricao, setDescricao] = useState(model?.descricao || "");
  const [largura, setLargura] = useState(String(model?.largura ?? ""));
  const [altura, setAltura] = useState(String(model?.altura ?? ""));
  const [largurapg, setLargurapg] = useState(String(model?.largurapg ?? ""));
  const [alturapg, setAlturapg] = useState(String(model?.alturapg ?? ""));
  const [linhaporpg, setLinhaporpg] = useState(String(model?.linhaporpg ?? ""));
  const [colunaporpg, setColunaporpg] = useState(String(model?.colunaporpg ?? ""));
  const [frente, setFrente] = useState(model?.frente || "");
  const [verso, setVerso] = useState(model?.verso || "");
  const [validademeses, setValidademeses] = useState(String(model?.validademeses ?? "12"));
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File, side: "front" | "back") {
    if (side === "front") setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${apiBase}/credential-models/upload-image`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        if (side === "front") setFrente(data.url);
        else setVerso(data.url);
      } else {
        setError("Erro ao fazer upload da imagem.");
      }
    } catch {
      setError("Erro de conexão no upload.");
    } finally {
      if (side === "front") setUploadingFront(false);
      else setUploadingBack(false);
    }
  }

  async function handleSubmit() {
    if (!tipo && !nome) { setError("Selecione o tipo/nome."); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        nome: nome || tipo,
        tipo: tipo || nome,
        descricao: descricao || null,
        largura: largura ? Number(largura) : null,
        altura: altura ? Number(altura) : null,
        largurapg: largurapg ? Number(largurapg) : null,
        alturapg: alturapg ? Number(alturapg) : null,
        linhaporpg: linhaporpg ? Number(linhaporpg) : null,
        colunaporpg: colunaporpg ? Number(colunaporpg) : null,
        frente: frente || null,
        verso: verso || null,
        validademeses: validademeses ? Number(validademeses) : null,
        ativo: true,
      };
      const url = isNew ? `${apiBase}/credential-models` : `${apiBase}/credential-models/${model!.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onSaved();
      else { const d = await res.json(); setError(d.error || "Erro ao salvar."); }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <CreditCard size={20} className="text-purple-600" />
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{isNew ? "Novo Modelo de Carteirinha" : "Editar Modelo"}</h3>
            <p className="text-xs text-slate-500">Cadastre imagem frente/verso, dimensões e layout para impressão</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tipo + Nome interno */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Tipo <span className="text-red-500">*</span></label>
              <select
                value={tipo}
                onChange={(e) => { setTipo(e.target.value); if (!nome) setNome(e.target.value.toLowerCase().replace(/\s+/g, '')); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
              >
                <option value="">Selecione...</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nome do Modelo <span className="text-red-500">*</span></label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: credpastor"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição opcional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Imagens Frente e Verso</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Front */}
              <div>
                <p className="text-xs text-slate-600 mb-1">Frente</p>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-lg aspect-[85.6/53.98] flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors overflow-hidden"
                  onClick={() => !uploadingFront && frontRef.current?.click()}
                >
                  {uploadingFront ? (
                    <Loader2 size={22} className="animate-spin text-purple-500" />
                  ) : frente ? (
                    <img src={frente} alt="frente" className="w-full h-full object-contain" />
                  ) : (
                    <><Image size={28} className="text-slate-300 mb-1" /><span className="text-xs text-slate-400">Sem imagem</span></>
                  )}
                </div>
                <input ref={frontRef} type="file" accept="image/*,.svg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "front"); }} />
                <button
                  onClick={() => frontRef.current?.click()}
                  disabled={uploadingFront}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 border border-slate-200 rounded-lg py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingFront ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload Frente
                </button>
              </div>
              {/* Back */}
              <div>
                <p className="text-xs text-slate-600 mb-1">Verso</p>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-lg aspect-[85.6/53.98] flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors overflow-hidden"
                  onClick={() => !uploadingBack && backRef.current?.click()}
                >
                  {uploadingBack ? (
                    <Loader2 size={22} className="animate-spin text-purple-500" />
                  ) : verso ? (
                    <img src={verso} alt="verso" className="w-full h-full object-contain" />
                  ) : (
                    <><Image size={28} className="text-slate-300 mb-1" /><span className="text-xs text-slate-400">Sem imagem</span></>
                  )}
                </div>
                <input ref={backRef} type="file" accept="image/*,.svg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "back"); }} />
                <button
                  onClick={() => backRef.current?.click()}
                  disabled={uploadingBack}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 border border-slate-200 rounded-lg py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingBack ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload Verso
                </button>
              </div>
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Dimensões</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Largura Cartão (mm)</label>
                <input type="number" value={largura} onChange={(e) => setLargura(e.target.value)} placeholder="Ex: 85.6" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Altura Cartão (mm)</label>
                <input type="number" value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="Ex: 53.98" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Largura Página (mm)</label>
                <input type="number" value={largurapg} onChange={(e) => setLargurapg(e.target.value)} placeholder="Ex: 212"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Altura Página (mm)</label>
                <input type="number" value={alturapg} onChange={(e) => setAlturapg(e.target.value)} placeholder="Ex: 298"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Linhas por Página</label>
                <input type="number" value={linhaporpg} onChange={(e) => setLinhaporpg(e.target.value)} placeholder="Ex: 2"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Colunas por Página</label>
                <input type="number" value={colunaporpg} onChange={(e) => setColunaporpg(e.target.value)} placeholder="Ex: 2"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Validade (meses)</label>
                <input type="number" value={validademeses} onChange={(e) => setValidademeses(e.target.value)} placeholder="Ex: 12"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
