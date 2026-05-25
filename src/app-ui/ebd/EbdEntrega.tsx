"use client";
import { useEffect, useState, useRef } from "react";
import { Truck, Plus, Loader2, Save, Printer, Search, Eye, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";

interface Church { id: string; name: string }
interface Trimestre { id: string; nome: string; ano: number }
interface Produto { id: string; nome: string; tipo: string; precoVenda: number; categoria: { nome: string } }
interface Member { id: string; fullName: string }
interface Entrega {
  id: string; numeroDoc: string; dataEntrega: string; status: string;
  valorTotal: number; saldoAnterior: number; novoSaldo: number; observacao?: string;
  church: { id: string; name: string };
  trimestre?: { id: string; nome: string; ano: number } | null;
  responsavel?: { id: string; fullName: string } | null;
  itens: Array<{ id: string; quantidade: number; valorUnit: number; valorTotal: number; produto: { id: string; nome: string; categoria: { nome: string } } }>;
}

function fmt(v: number) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function useCampoId() { try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string; } catch { return ""; } }
function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  separando: { label: "Separando", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  separado: { label: "Separado", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle2 },
  entregue: { label: "Entregue", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
};

interface EntregaItem { produtoId: string; quantidade: number; valorUnit: number }

export default function EbdEntrega() {
  const campoId = useCampoId();
  const [tab, setTab] = useState<"lista" | "nova">("lista");
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewEntrega, setViewEntrega] = useState<Entrega | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Form nova entrega
  const [form, setForm] = useState({
    churchId: "", trimestreId: "", dataEntrega: new Date().toISOString().slice(0, 10),
    responsavelId: "", observacao: "",
  });
  const [itens, setItens] = useState<EntregaItem[]>([{ produtoId: "", quantidade: 0, valorUnit: 0 }]);

  const fetchData = async () => {
    if (!campoId) return;
    setPageLoading(true);
    try {
      const [ent, tri, prod] = await Promise.all([
        authFetch<unknown>(`${apiBase}/ebd/entregas?campoId=${campoId}`),
        authFetch<unknown>(`${apiBase}/ebd/trimestres?campoId=${campoId}`),
        authFetch<unknown>(`${apiBase}/ebd/produtos?campoId=${campoId}&ativo=true`),
      ]);
      setEntregas(Array.isArray(ent) ? ent : []);
      setTrimestres(Array.isArray(tri) ? tri : []);
      setProdutos(Array.isArray(prod) ? prod : []);
    } catch { /* handled */ }
    setPageLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Carrega igrejas do campo
    if (campoId) {
      authFetch<{ rows?: Array<{ churchId: string; churchName: string }> }>(`${apiBase}/finance/cash-status/list`, {
        method: "POST",
        body: JSON.stringify({ year: 2026, months: [1], search: "" }),
      }).then((d) => {
        if (d.rows) setChurches(d.rows.map((r) => ({ id: r.churchId, name: r.churchName })));
      }).catch(() => null);
    }
  }, [campoId]);

  const addItem = () => setItens((p) => [...p, { produtoId: "", quantidade: 0, valorUnit: 0 }]);
  const removeItem = (i: number) => setItens((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof EntregaItem, val: string | number) =>
    setItens((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const onSelectProduto = (i: number, produtoId: string) => {
    const prod = produtos.find((p) => p.id === produtoId);
    setItens((p) => p.map((item, idx) => idx === i
      ? { ...item, produtoId, valorUnit: prod ? Number(prod.precoVenda) : 0 }
      : item
    ));
  };

  const total = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valorUnit), 0);

  const saveEntrega = async () => {
    const validItens = itens.filter((i) => i.produtoId && Number(i.quantidade) > 0);
    if (!form.churchId || !form.dataEntrega || validItens.length === 0) {
      alert("Preencha igreja, data e pelo menos um item"); return;
    }
    setLoading(true);
    try {
      const data = await authFetch<Entrega>(`${apiBase}/ebd/entregas`, {
        method: "POST",
        body: JSON.stringify({ ...form, campoId, itens: validItens }),
      });
      setForm({ churchId: "", trimestreId: "", dataEntrega: new Date().toISOString().slice(0, 10), responsavelId: "", observacao: "" });
      setItens([{ produtoId: "", quantidade: 0, valorUnit: 0 }]);
      await fetchData();
      setTab("lista");
      setViewEntrega(data);
    } catch {
      alert("Erro ao salvar entrega");
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(`${id}-${status}`);
    await authFetch(`${apiBase}/ebd/entregas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).catch(() => null);
    setUpdatingId(null);
    fetchData();
  };

  const printDoc = () => {
    if (!printRef.current || !viewEntrega) return;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${viewEntrega.numeroDoc}</title><style>
      @page{size:portrait;margin:15mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:0}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}
      th{background:#f0f0f0;font-weight:600}
      .total{font-weight:bold;font-size:13px}
      h3{margin:0 0 2px 0}
      p{margin:0}
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    doc.close();
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  const filtered = entregas.filter((e) => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (search && !e.church.name.toLowerCase().includes(search.toLowerCase()) && !e.numeroDoc.toLowerCase().includes(search.toLowerCase())) return false;
    const d = e.dataEntrega.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Truck className="w-6 h-6 text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Separação / Entrega</h1>
        </div>
        <button onClick={() => setTab("nova")}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" /> Nova Entrega
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[["lista", "Entregas"], ["nova", "Nova Entrega"]] .map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === k ? "border-purple-600 text-purple-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {tab === "lista" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Buscar igreja ou doc..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-slate-400 text-center py-10">Nenhuma entrega encontrada</p>
            ) : filtered.map((e) => {
              const sc = STATUS_CFG[e.status] || STATUS_CFG.separando;
              const Icon = sc.icon;
              return (
                <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-800">{e.church.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 ${sc.color}`}>
                          <Icon className="w-3 h-3" /> {sc.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{e.numeroDoc} · {new Date(e.dataEntrega).toLocaleDateString("pt-BR")}</p>
                      {e.trimestre && <p className="text-xs text-slate-400">{e.trimestre.nome}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">R$ {fmt(e.valorTotal)}</p>
                      <p className="text-xs text-slate-500">Saldo: R$ {fmt(e.novoSaldo)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => setViewEntrega(e)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border rounded-lg text-slate-600 hover:bg-slate-50">
                      <Eye className="w-3 h-3" /> Ver
                    </button>
                    {e.status !== "entregue" && e.status !== "cancelado" && (
                      <>
                        {e.status === "separando" && (
                          <button onClick={() => updateStatus(e.id, "separado")} disabled={!!updatingId}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-60">
                            {updatingId === `${e.id}-separado` ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Marcar Separado
                          </button>
                        )}
                        {(e.status === "separando" || e.status === "separado") && (
                          <button onClick={() => updateStatus(e.id, "entregue")} disabled={!!updatingId}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-60">
                            {updatingId === `${e.id}-entregue` ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Confirmar Entrega
                          </button>
                        )}
                        <button onClick={() => { if (confirm("Cancelar esta entrega? Esta ação não pode ser desfeita.")) updateStatus(e.id, "cancelado"); }} disabled={!!updatingId}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-60">
                          {updatingId === `${e.id}-cancelado` ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nova entrega */}
      {tab === "nova" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800">Dados da Entrega</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Igreja *</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.churchId}
                  onChange={(e) => setForm((p) => ({ ...p, churchId: e.target.value }))}>
                  <option value="">Selecione a igreja</option>
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Trimestre</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.trimestreId}
                  onChange={(e) => setForm((p) => ({ ...p, trimestreId: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {trimestres.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Data *</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.dataEntrega}
                  onChange={(e) => setForm((p) => ({ ...p, dataEntrega: e.target.value }))} />
              </div>
              <div className="col-span-full">
                <label className="block text-xs font-medium text-slate-500 mb-1">Observação</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.observacao}
                  onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800">Itens do Pedido</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["Produto", "Qtd", "Valor Unit.", "Subtotal", ""].map((h) => (
                      <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2">
                        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={item.produtoId}
                          onChange={(e) => onSelectProduto(idx, e.target.value)}>
                          <option value="">Selecione</option>
                          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.categoria.nome})</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2 w-24">
                        <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm text-center" value={item.quantidade}
                          onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))} />
                      </td>
                      <td className="py-2 pr-2 w-28">
                        <input type="number" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={item.valorUnit}
                          onChange={(e) => updateItem(idx, "valorUnit", Number(e.target.value))} />
                      </td>
                      <td className="py-2 pr-2 w-28 text-right font-medium text-slate-800">
                        R$ {fmt(Number(item.quantidade) * Number(item.valorUnit))}
                      </td>
                      <td className="py-2 w-8">
                        <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-500 rounded">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={addItem} className="flex items-center gap-1 text-sm text-purple-600 hover:underline">
              <Plus className="w-4 h-4" /> Adicionar produto
            </button>

            <div className="border-t pt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                <p>Qtd total: <span className="font-bold text-slate-800">{itens.reduce((s, i) => s + Number(i.quantidade), 0)} un</span></p>
                <p>Valor total: <span className="font-bold text-slate-900">R$ {fmt(total)}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTab("lista")} className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={saveEntrega} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar e Gerar Documento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualização / impressão */}
      {viewEntrega && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Comprovante de Entrega</h2>
                <div className="flex gap-2">
                  <button onClick={printDoc}
                    className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                  <button onClick={() => setViewEntrega(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded">✕</button>
                </div>
              </div>

              <div ref={printRef}>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="text-center border-b pb-3">
                    <h3 className="font-bold text-lg">COMPROVANTE EBD</h3>
                    <p className="text-sm text-slate-600">Documento Nº {viewEntrega.numeroDoc}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="font-semibold">Igreja:</span> {viewEntrega.church.name}</div>
                    <div><span className="font-semibold">Data:</span> {new Date(viewEntrega.dataEntrega).toLocaleDateString("pt-BR")}</div>
                    {viewEntrega.trimestre && <div><span className="font-semibold">Trimestre:</span> {viewEntrega.trimestre.nome}</div>}
                    <div><span className="font-semibold">Status:</span> {STATUS_CFG[viewEntrega.status]?.label}</div>
                  </div>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border px-2 py-1 text-left">Produto</th>
                        <th className="border px-2 py-1 text-center">Qtd</th>
                        <th className="border px-2 py-1 text-right">Valor Unit.</th>
                        <th className="border px-2 py-1 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewEntrega.itens.map((item) => (
                        <tr key={item.id}>
                          <td className="border px-2 py-1">{item.produto.nome} ({item.produto.categoria.nome})</td>
                          <td className="border px-2 py-1 text-center">{item.quantidade}</td>
                          <td className="border px-2 py-1 text-right">R$ {fmt(item.valorUnit)}</td>
                          <td className="border px-2 py-1 text-right">R$ {fmt(item.valorTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Saldo anterior:</span><span className="font-medium">R$ {fmt(viewEntrega.saldoAnterior)}</span></div>
                    <div className="flex justify-between"><span>Valor desta entrega:</span><span className="font-medium text-blue-700">+ R$ {fmt(viewEntrega.valorTotal)}</span></div>
                    <div className="flex justify-between font-bold text-base"><span>Novo saldo:</span><span className="text-orange-700">R$ {fmt(viewEntrega.novoSaldo)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 pt-6 mt-4 border-t">
                    <div className="text-center border-t border-slate-400 pt-2"><p className="text-xs text-slate-500">Responsável pela retirada</p></div>
                    <div className="text-center border-t border-slate-400 pt-2"><p className="text-xs text-slate-500">Responsável pela entrega</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
