"use client";
import { useEffect, useState } from "react";
import { Package, Plus, Loader2, Save, Search, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";

interface EstoqueItem {
  id: string; quantidade: number;
  produto: { id: string; nome: string; tipo: string; codigo?: string; precoVenda: number; precoCusto: number; categoria: { nome: string }; trimestre?: { nome: string; ano: number } | null };
}
interface Produto { id: string; nome: string; tipo: string; categoria: { nome: string }; precoVenda: number }
interface Entrada {
  id: string; fornecedor?: string; numNf?: string; dataEntrada: string; valorTotal: number;
  itens: Array<{ id: string; quantidade: number; valorUnit: number; valorTotal: number; produto: { nome: string } }>;
}

function fmt(v: number) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function useCampoId() {
  try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string; } catch { return ""; }
}

interface EntradaItem { produtoId: string; quantidade: number; valorUnit: number }

export default function EbdEstoque() {
  const campoId = useCampoId();
  const [tab, setTab] = useState<"saldo" | "entrada" | "historico">("saldo");
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [editingEntrada, setEditingEntrada] = useState<string | null>(null);
  const [editEntForm, setEditEntForm] = useState({ fornecedor: "", numNf: "", dataEntrada: "", observacao: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEntId, setDeletingEntId] = useState<string | null>(null);

  // Formulário de entrada
  const [entForm, setEntForm] = useState({ fornecedor: "", numNf: "", dataEntrada: new Date().toISOString().slice(0, 10), observacao: "" });
  const [entItens, setEntItens] = useState<EntradaItem[]>([{ produtoId: "", quantidade: 0, valorUnit: 0 }]);

  const fetchData = async () => {
    if (!campoId) return;
    setPageLoading(true);
    try {
      const [e, en, p] = await Promise.all([
        authFetch<unknown>(`${apiBase}/ebd/estoque?campoId=${campoId}`),
        authFetch<unknown>(`${apiBase}/ebd/estoque/entrada?campoId=${campoId}`),
        authFetch<unknown>(`${apiBase}/ebd/produtos?campoId=${campoId}&ativo=true`),
      ]);
      setEstoque(Array.isArray(e) ? e : []);
      setEntradas(Array.isArray(en) ? en : []);
      setProdutos(Array.isArray(p) ? p : []);
    } catch { /* handled */ }
    setPageLoading(false);
  };

  useEffect(() => { fetchData(); }, [campoId]);

  const addItem = () => setEntItens((p) => [...p, { produtoId: "", quantidade: 0, valorUnit: 0 }]);
  const removeItem = (i: number) => setEntItens((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof EntradaItem, val: string | number) => {
    setEntItens((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  };

  const totalEntrada = entItens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valorUnit)), 0);

  const deleteEntrada = async (id: string) => {
    if (!confirm("Excluir esta entrada? O estoque será revertido e a operação não pode ser desfeita.")) return;
    setDeletingEntId(id);
    await authFetch(`${apiBase}/ebd/estoque/entrada/${id}?campoId=${campoId}`, { method: "DELETE" }).catch(() => null);
    setDeletingEntId(null);
    await fetchData();
  };

  const saveEditEntrada = async (id: string) => {
    setSavingEdit(true);
    try {
      await authFetch(`${apiBase}/ebd/estoque/entrada/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...editEntForm, campoId }),
      });
      setEditingEntrada(null);
      await fetchData();
    } catch {}
    setSavingEdit(false);
  };

  const saveEntrada = async () => {
    const validItens = entItens.filter((i) => i.produtoId && Number(i.quantidade) > 0);
    if (!entForm.dataEntrada || validItens.length === 0) {
      alert("Preencha a data e pelo menos um item válido"); return;
    }
    setLoading(true);
    try {
      await authFetch(`${apiBase}/ebd/estoque/entrada`, {
        method: "POST",
        body: JSON.stringify({ ...entForm, campoId, itens: validItens }),
      });
      setEntForm({ fornecedor: "", numNf: "", dataEntrada: new Date().toISOString().slice(0, 10), observacao: "" });
      setEntItens([{ produtoId: "", quantidade: 0, valorUnit: 0 }]);
      await fetchData();
      setTab("saldo");
    } catch {
      alert("Erro ao salvar entrada");
    }
    setLoading(false);
  };

  const filtered = estoque.filter((e) =>
    !search || e.produto.nome.toLowerCase().includes(search.toLowerCase()) ||
    e.produto.categoria.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-green-500" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg"><Package className="w-6 h-6 text-green-600" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque EBD</h1>
        </div>
        <button onClick={() => setTab("entrada")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          <Plus className="w-4 h-4" /> Registrar Entrada
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[["saldo", "Saldo Atual"], ["entrada", "Registrar Entrada"], ["historico", "Histórico Entradas"]] .map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Saldo */}
      {tab === "saldo" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Buscar produto..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Produto", "Categoria", "Trimestre", "Saldo", "Preço Venda", "Valor em Estoque"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sem itens no estoque</td></tr>
                ) : filtered.map((e) => (
                  <tr key={e.id} className={`hover:bg-slate-50 ${e.quantidade <= 10 ? "bg-yellow-50/50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.produto.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{e.produto.categoria.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{e.produto.trimestre?.nome || "–"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${e.quantidade <= 10 ? "text-red-600" : e.quantidade <= 30 ? "text-yellow-600" : "text-green-700"}`}>
                        {e.quantidade} un
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">R$ {fmt(e.produto.precoVenda)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      R$ {fmt(e.quantidade * Number(e.produto.precoVenda))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Entrada */}
      {tab === "entrada" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" /> Dados da Entrada
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Fornecedor</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={entForm.fornecedor}
                  onChange={(e) => setEntForm((p) => ({ ...p, fornecedor: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nº Nota Fiscal</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={entForm.numNf}
                  onChange={(e) => setEntForm((p) => ({ ...p, numNf: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Data *</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={entForm.dataEntrada}
                  onChange={(e) => setEntForm((p) => ({ ...p, dataEntrada: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Observação</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={entForm.observacao}
                  onChange={(e) => setEntForm((p) => ({ ...p, observacao: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-800">Itens da Entrada</h3>
            <div className="space-y-3">
              {entItens.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Produto</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={item.produtoId}
                      onChange={(e) => updateItem(idx, "produtoId", e.target.value)}>
                      <option value="">Selecione</option>
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.categoria.nome})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Quantidade</label>
                    <input type="number" min={1} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={item.quantidade}
                      onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Valor Unit.</label>
                    <input type="number" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={item.valorUnit}
                      onChange={(e) => updateItem(idx, "valorUnit", Number(e.target.value))} />
                  </div>
                  <div className="col-span-2 text-right">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Subtotal</label>
                    <p className="px-3 py-2 text-sm font-medium text-slate-800">
                      R$ {fmt(Number(item.quantidade) * Number(item.valorUnit))}
                    </p>
                  </div>
                  <div className="col-span-1 flex justify-end pb-1">
                    <button onClick={() => removeItem(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="flex items-center gap-1 text-sm text-purple-600 hover:underline">
              <Plus className="w-4 h-4" /> Adicionar item
            </button>

            <div className="border-t pt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {entItens.filter((i) => i.produtoId).length} produto(s) — Total:
                <span className="font-bold text-slate-900 ml-1">R$ {fmt(totalEntrada)}</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => setTab("saldo")} className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={saveEntrada} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Entrada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de entradas */}
      {tab === "historico" && (
        <div className="space-y-4">
          {entradas.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Nenhuma entrada registrada</p>
          ) : entradas.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {editingEntrada === e.id ? (
                <div className="p-5 space-y-4">
                  <h4 className="font-semibold text-slate-800 text-sm">Editar Entrada</h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Fornecedor</label>
                      <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={editEntForm.fornecedor} onChange={(ev) => setEditEntForm((p) => ({ ...p, fornecedor: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Nº NF</label>
                      <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={editEntForm.numNf} onChange={(ev) => setEditEntForm((p) => ({ ...p, numNf: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                      <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={editEntForm.dataEntrada} onChange={(ev) => setEditEntForm((p) => ({ ...p, dataEntrada: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Observação</label>
                      <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={editEntForm.observacao} onChange={(ev) => setEditEntForm((p) => ({ ...p, observacao: ev.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEditEntrada(e.id)} disabled={savingEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                      {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                    </button>
                    <button onClick={() => setEditingEntrada(null)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-slate-800">{e.fornecedor || "Fornecedor não informado"}</p>
                      <p className="text-sm text-slate-500">NF: {e.numNf || "–"} · {new Date(e.dataEntrada).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-green-700">R$ {fmt(e.valorTotal)}</p>
                      <button
                        onClick={() => { setEditingEntrada(e.id); setEditEntForm({ fornecedor: e.fornecedor || "", numNf: e.numNf || "", dataEntrada: e.dataEntrada.slice(0, 10), observacao: "" }); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEntrada(e.id)} disabled={deletingEntId === e.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                        {deletingEntId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {e.itens.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-slate-600">
                        <span>{item.produto.nome}</span>
                        <span className="text-slate-400">{item.quantidade} un × R$ {fmt(item.valorUnit)} = <span className="text-slate-700 font-medium">R$ {fmt(item.valorTotal)}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
