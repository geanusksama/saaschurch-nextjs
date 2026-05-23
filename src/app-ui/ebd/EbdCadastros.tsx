"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, BookOpen, Loader2, Save } from "lucide-react";
import { authFetch } from "../../lib/secretariaHooks";
import { apiBase } from "../../lib/apiBase";

interface Trimestre { id: string; nome: string; ano: number; dataInicio: string; dataFim: string; ativo: boolean }
interface Categoria { id: string; nome: string; descricao?: string; ordem: number }
interface Produto {
  id: string; nome: string; tipo: string; codigo?: string; tema?: string;
  precoVenda: number; precoCusto: number; ativo: boolean;
  categoria: { id: string; nome: string };
  trimestre?: { id: string; nome: string; ano: number } | null;
}

const TIPOS_PRODUTO = ["Revista", "Livro", "Material", "Apoio"];
const CATEGORIAS_PADRAO = ["Adultos", "Jovens", "Juvenis", "Adolescentes", "Kids", "Berçário", "Professor", "Material Apoio"];

function fmt(v: number) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCampoId() {
  try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string; } catch { return ""; }
}

// Input / select com padrão do sistema
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400";
const selectCls = inputCls;
const labelCls = "block text-xs font-medium text-slate-500 mb-1";

export default function EbdCadastros() {
  const campoId = useCampoId();
  const [tab, setTab] = useState<"trimestres" | "categorias" | "produtos">("trimestres");

  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [trimestreForm, setTrimestreForm] = useState({ nome: "", ano: new Date().getFullYear(), dataInicio: "", dataFim: "", ativo: true });
  const [editingTrimestre, setEditingTrimestre] = useState<string | null>(null);
  const [showTriForm, setShowTriForm] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catForm, setCatForm] = useState({ nome: "", descricao: "", ordem: 0 });
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [prodForm, setProdForm] = useState({
    nome: "", tipo: "Revista", categoriaId: "", trimestreId: "", codigo: "", tema: "",
    descricao: "", unidade: "un", precoCusto: 0, precoVenda: 0, ativo: true,
  });
  const [editingProd, setEditingProd] = useState<string | null>(null);
  const [showProdForm, setShowProdForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codigoManualRef = useRef(false);

  // Auto-gera código quando tipo/categoria/trimestre mudam (só no cadastro novo)
  useEffect(() => {
    if (editingProd || codigoManualRef.current) return;
    if (!prodForm.tipo || !prodForm.categoriaId) return;
    const cat = categorias.find((c) => c.id === prodForm.categoriaId);
    const tri = trimestres.find((t) => t.id === prodForm.trimestreId);
    if (!cat) return;
    const tipoPart = prodForm.tipo.slice(0, 3).toUpperCase();
    const catPart = cat.nome.slice(0, 3).toUpperCase();
    const triPart = tri ? (() => {
      const num = tri.nome.match(/\d+/)?.[0] || "1";
      return `${num}T${String(tri.ano).slice(-2)}`;
    })() : "";
    setProdForm((p) => ({ ...p, codigo: triPart ? `${tipoPart}-${catPart}-${triPart}` : `${tipoPart}-${catPart}` }));
  }, [prodForm.tipo, prodForm.categoriaId, prodForm.trimestreId, editingProd, categorias, trimestres]);

  const fetchAll = async () => {
    if (!campoId) return;
    setPageLoading(true);
    try {
      const [t, c, p] = await Promise.all([
        authFetch<Trimestre[]>(`${apiBase}/ebd/trimestres?campoId=${campoId}`),
        authFetch<Categoria[]>(`${apiBase}/ebd/categorias?campoId=${campoId}`),
        authFetch<Produto[]>(`${apiBase}/ebd/produtos?campoId=${campoId}`),
      ]);
      setTrimestres(Array.isArray(t) ? t : []);
      setCategorias(Array.isArray(c) ? c : []);
      setProdutos(Array.isArray(p) ? p : []);
    } catch (e) {
      setError(String(e));
    }
    setPageLoading(false);
  };

  useEffect(() => { fetchAll(); }, [campoId]);

  // ── Trimestres ────────────────────────────────────────────────────────────

  const saveTrimestre = async () => {
    if (!trimestreForm.nome) { setError("Informe o nome do trimestre"); return; }
    setLoading(true); setError(null);
    try {
      const url = editingTrimestre ? `${apiBase}/ebd/trimestres/${editingTrimestre}` : `${apiBase}/ebd/trimestres`;
      await authFetch(url, { method: editingTrimestre ? "PUT" : "POST", body: JSON.stringify({ ...trimestreForm, campoId }) });
      setShowTriForm(false); setEditingTrimestre(null);
      setTrimestreForm({ nome: "", ano: new Date().getFullYear(), dataInicio: "", dataFim: "", ativo: true });
      await fetchAll();
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const deleteTrimestre = async (id: string) => {
    if (!confirm("Excluir este trimestre? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    await authFetch(`${apiBase}/ebd/trimestres/${id}`, { method: "DELETE" }).catch(() => null);
    setDeletingId(null);
    fetchAll();
  };

  // ── Categorias ────────────────────────────────────────────────────────────

  const saveCategoria = async () => {
    if (!catForm.nome) { setError("Informe o nome da categoria"); return; }
    setLoading(true); setError(null);
    try {
      const url = editingCat ? `${apiBase}/ebd/categorias/${editingCat}` : `${apiBase}/ebd/categorias`;
      await authFetch(url, { method: editingCat ? "PUT" : "POST", body: JSON.stringify({ ...catForm, campoId }) });
      setShowCatForm(false); setEditingCat(null);
      setCatForm({ nome: "", descricao: "", ordem: 0 });
      await fetchAll();
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const deleteCategoria = async (id: string) => {
    if (!confirm("Excluir esta categoria? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    await authFetch(`${apiBase}/ebd/categorias/${id}`, { method: "DELETE" }).catch(() => null);
    setDeletingId(null);
    fetchAll();
  };

  const seedCategorias = async () => {
    setLoading(true); setError(null);
    try {
      for (let i = 0; i < CATEGORIAS_PADRAO.length; i++) {
        await authFetch(`${apiBase}/ebd/categorias`, {
          method: "POST",
          body: JSON.stringify({ nome: CATEGORIAS_PADRAO[i], ordem: i, campoId }),
        });
      }
      await fetchAll();
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  // ── Produtos ──────────────────────────────────────────────────────────────

  const saveProduto = async () => {
    if (!prodForm.nome || !prodForm.categoriaId || !prodForm.tipo) {
      setError("Preencha nome, categoria e tipo"); return;
    }
    setLoading(true); setError(null);
    try {
      const url = editingProd ? `${apiBase}/ebd/produtos/${editingProd}` : `${apiBase}/ebd/produtos`;
      await authFetch(url, { method: editingProd ? "PUT" : "POST", body: JSON.stringify({ ...prodForm, campoId }) });
      setShowProdForm(false); setEditingProd(null);
      setProdForm({ nome: "", tipo: "Revista", categoriaId: "", trimestreId: "", codigo: "", tema: "", descricao: "", unidade: "un", precoCusto: 0, precoVenda: 0, ativo: true });
      await fetchAll();
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const deleteProduto = async (id: string) => {
    if (!confirm("Excluir este produto? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    await authFetch(`${apiBase}/ebd/produtos/${id}`, { method: "DELETE" }).catch(() => null);
    setDeletingId(null);
    fetchAll();
  };

  const TABS = [
    { key: "trimestres", label: "Trimestres" },
    { key: "categorias", label: "Categorias" },
    { key: "produtos", label: "Produtos" },
  ] as const;

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <BookOpen className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cadastros EBD</h1>
          <p className="text-sm text-slate-500">Trimestres, categorias e produtos</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Trimestres ── */}
      {tab === "trimestres" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowTriForm(true); setEditingTrimestre(null); setTrimestreForm({ nome: "", ano: new Date().getFullYear(), dataInicio: "", dataFim: "", ativo: true }); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Trimestre
            </button>
          </div>

          {showTriForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">{editingTrimestre ? "Editar" : "Novo"} Trimestre</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nome</label>
                  <input className={inputCls} value={trimestreForm.nome} placeholder="1º Trimestre 2026"
                    onChange={(e) => setTrimestreForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Ano</label>
                  <input type="number" className={inputCls} value={trimestreForm.ano}
                    onChange={(e) => setTrimestreForm((p) => ({ ...p, ano: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Data Início</label>
                  <input type="date" className={inputCls} value={trimestreForm.dataInicio}
                    onChange={(e) => setTrimestreForm((p) => ({ ...p, dataInicio: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Data Fim</label>
                  <input type="date" className={inputCls} value={trimestreForm.dataFim}
                    onChange={(e) => setTrimestreForm((p) => ({ ...p, dataFim: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mt-4">
                <input type="checkbox" className="rounded border-slate-300" checked={trimestreForm.ativo}
                  onChange={(e) => setTrimestreForm((p) => ({ ...p, ativo: e.target.checked }))} />
                Ativo
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={saveTrimestre} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
                <button onClick={() => { setShowTriForm(false); setEditingTrimestre(null); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Nome", "Ano", "Período", "Ativo", "Ações"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trimestres.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Nenhum trimestre cadastrado</td></tr>
                ) : trimestres.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{t.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{t.ano}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.dataInicio).toLocaleDateString("pt-BR")} – {new Date(t.dataFim).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {t.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingTrimestre(t.id); setTrimestreForm({ nome: t.nome, ano: t.ano, dataInicio: t.dataInicio.slice(0, 10), dataFim: t.dataFim.slice(0, 10), ativo: t.ativo }); setShowTriForm(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteTrimestre(t.id)} disabled={deletingId === t.id} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                          {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Categorias ── */}
      {tab === "categorias" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {categorias.length === 0 && (
              <button onClick={seedCategorias} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Inserir categorias padrão
              </button>
            )}
            <button onClick={() => { setShowCatForm(true); setEditingCat(null); setCatForm({ nome: "", descricao: "", ordem: 0 }); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">
              <Plus className="w-4 h-4" /> Nova Categoria
            </button>
          </div>

          {showCatForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">{editingCat ? "Editar" : "Nova"} Categoria</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Nome</label>
                  <input className={inputCls} value={catForm.nome} placeholder="Ex: Adultos"
                    onChange={(e) => setCatForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Ordem</label>
                  <input type="number" className={inputCls} value={catForm.ordem}
                    onChange={(e) => setCatForm((p) => ({ ...p, ordem: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Descrição</label>
                  <input className={inputCls} value={catForm.descricao} placeholder="Opcional"
                    onChange={(e) => setCatForm((p) => ({ ...p, descricao: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveCategoria} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
                <button onClick={() => { setShowCatForm(false); setEditingCat(null); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categorias.length === 0 ? (
              <p className="col-span-full text-slate-400 text-sm text-center py-8 bg-white rounded-xl border border-slate-200">
                Nenhuma categoria. Clique em "Inserir categorias padrão".
              </p>
            ) : categorias.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:border-slate-300 transition-colors">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{c.nome}</p>
                  {c.descricao && <p className="text-xs text-slate-400 mt-0.5">{c.descricao}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingCat(c.id); setCatForm({ nome: c.nome, descricao: c.descricao || "", ordem: c.ordem }); setShowCatForm(true); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategoria(c.id)} disabled={deletingId === c.id} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                    {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Produtos ── */}
      {tab === "produtos" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowProdForm(true); setEditingProd(null); codigoManualRef.current = false; setProdForm({ nome: "", tipo: "Revista", categoriaId: "", trimestreId: "", codigo: "", tema: "", descricao: "", unidade: "un", precoCusto: 0, precoVenda: 0, ativo: true }); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          </div>

          {showProdForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">{editingProd ? "Editar" : "Novo"} Produto</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className={labelCls}>Nome *</label>
                  <input className={inputCls} value={prodForm.nome} placeholder="Ex: Revista Adultos"
                    onChange={(e) => setProdForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Tipo *</label>
                  <select className={selectCls} value={prodForm.tipo}
                    onChange={(e) => setProdForm((p) => ({ ...p, tipo: e.target.value }))}>
                    {TIPOS_PRODUTO.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Categoria *</label>
                  <select className={selectCls} value={prodForm.categoriaId}
                    onChange={(e) => setProdForm((p) => ({ ...p, categoriaId: e.target.value }))}>
                    <option value="">Selecione a categoria</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Trimestre</label>
                  <select className={selectCls} value={prodForm.trimestreId}
                    onChange={(e) => setProdForm((p) => ({ ...p, trimestreId: e.target.value }))}>
                    <option value="">Nenhum</option>
                    {trimestres.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Código <span className="text-slate-400 font-normal">(gerado automaticamente)</span></label>
                  <input className={inputCls} value={prodForm.codigo} placeholder="Ex: REV-ADU-1T26"
                    onChange={(e) => { codigoManualRef.current = true; setProdForm((p) => ({ ...p, codigo: e.target.value })); }} />
                </div>
                <div>
                  <label className={labelCls}>Tema</label>
                  <input className={inputCls} value={prodForm.tema} placeholder="Opcional"
                    onChange={(e) => setProdForm((p) => ({ ...p, tema: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Preço Custo (R$)</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={prodForm.precoCusto}
                    onChange={(e) => setProdForm((p) => ({ ...p, precoCusto: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Preço Venda (R$)</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={prodForm.precoVenda}
                    onChange={(e) => setProdForm((p) => ({ ...p, precoVenda: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Unidade</label>
                  <input className={inputCls} value={prodForm.unidade}
                    onChange={(e) => setProdForm((p) => ({ ...p, unidade: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mt-4">
                <input type="checkbox" className="rounded border-slate-300" checked={prodForm.ativo}
                  onChange={(e) => setProdForm((p) => ({ ...p, ativo: e.target.checked }))} />
                Ativo
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={saveProduto} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
                <button onClick={() => { setShowProdForm(false); setEditingProd(null); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Código", "Nome", "Tipo", "Categoria", "Trimestre", "Venda", "Ativo", "Ações"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtos.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Nenhum produto cadastrado</td></tr>
                ) : produtos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.codigo || "–"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{p.tipo}</td>
                    <td className="px-4 py-3 text-slate-600">{p.categoria.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{p.trimestre?.nome || "–"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">R$ {fmt(p.precoVenda)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => {
                          setEditingProd(p.id);
                          setProdForm({ nome: p.nome, tipo: p.tipo, categoriaId: p.categoria.id, trimestreId: p.trimestre?.id || "", codigo: p.codigo || "", tema: p.tema || "", descricao: "", unidade: "un", precoCusto: Number(p.precoCusto), precoVenda: Number(p.precoVenda), ativo: p.ativo });
                          setShowProdForm(true);
                        }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProduto(p.id)} disabled={deletingId === p.id} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                          {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
