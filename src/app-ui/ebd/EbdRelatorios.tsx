"use client";
import { useEffect, useState } from "react";
import { BarChart3, Download, Loader2, Search, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";

type ReportType = "retiradas" | "financeiro" | "estoque" | "inadimplencia";

interface Trimestre { id: string; nome: string; ano: number }

function fmt(v: number) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function useCampoId() { try { return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string; } catch { return ""; } }

export default function EbdRelatorios() {
  const campoId = useCampoId();
  const [tipo, setTipo] = useState<ReportType>("retiradas");
  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [filterTri, setFilterTri] = useState("");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[] | { estoque: unknown[]; movimentos: unknown[] } | null>(null);

  useEffect(() => {
    if (!campoId) return;
    authFetch<unknown>(`${apiBase}/ebd/trimestres?campoId=${campoId}`).then((t) => setTrimestres(Array.isArray(t) ? t as Trimestre[] : [])).catch(() => null);
  }, [campoId]);

  const buscar = async () => {
    if (!campoId) return;
    setLoading(true);
    const params = new URLSearchParams({ campoId, tipo });
    if (filterTri) params.set("trimestreId", filterTri);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    const res = await authFetch<unknown>(`${apiBase}/ebd/relatorios?${params}`).catch(() => null);
    setData(res);
    setLoading(false);
  };

  const exportExcel = () => {
    if (!data) return;
    let rows: Record<string, unknown>[] = [];

    if (tipo === "retiradas" && Array.isArray(data)) {
      rows = data.flatMap((e: { numeroDoc: string; dataEntrega: string; church: { name: string }; status: string; valorTotal: number; itens: Array<{ produto: { nome: string; categoria: { nome: string } }; quantidade: number; valorUnit: number; valorTotal: number }> }) =>
        e.itens.map((i) => ({
          "Documento": e.numeroDoc,
          "Data": new Date(e.dataEntrega).toLocaleDateString("pt-BR"),
          "Igreja": e.church.name,
          "Status": e.status,
          "Produto": i.produto.nome,
          "Categoria": i.produto.categoria.nome,
          "Qtd": i.quantidade,
          "Valor Unit.": Number(i.valorUnit),
          "Total": Number(i.valorTotal),
          "Total Entrega": Number(e.valorTotal),
        }))
      );
    } else if (tipo === "financeiro" && Array.isArray(data)) {
      rows = data.map((r: { church: { name: string }; trimestre?: { nome: string } | null; saldo: number; movimentos: Array<{ tipo: string; valor: number; data: string }> }) => ({
        "Igreja": r.church.name,
        "Trimestre": r.trimestre?.nome || "",
        "Saldo": Number(r.saldo),
        "Qtd Movimentos": r.movimentos.length,
        "Último pagamento": r.movimentos.filter((m) => m.tipo === "pagamento").at(-1)?.data
          ? new Date(r.movimentos.filter((m) => m.tipo === "pagamento").at(-1)!.data).toLocaleDateString("pt-BR")
          : "",
      }));
    } else if (tipo === "inadimplencia" && Array.isArray(data)) {
      rows = data.map((r: { church: { name: string; regional?: { name: string } | null }; trimestre?: { nome: string } | null; saldo: number }) => ({
        "Igreja": r.church.name,
        "Regional": r.church.regional?.name || "",
        "Trimestre": r.trimestre?.nome || "",
        "Saldo Devedor": Number(r.saldo),
      }));
    } else if (tipo === "estoque" && !Array.isArray(data)) {
      const d = data as { estoque: Array<{ produto: { nome: string; categoria: { nome: string }; trimestre?: { nome: string } | null }; quantidade: number }>; movimentos: unknown[] };
      rows = d.estoque.map((e) => ({
        "Produto": e.produto.nome,
        "Categoria": e.produto.categoria.nome,
        "Trimestre": e.produto.trimestre?.nome || "",
        "Saldo": e.quantidade,
      }));
    }

    if (rows.length === 0) { alert("Sem dados para exportar"); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EBD");
    XLSX.writeFile(wb, `ebd_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printReport = () => {
    if (!data) return;
    const tipoLabel = TIPOS_LABEL[tipo] || "Relatório";
    let headerCells = "";
    let bodyRows = "";

    if (tipo === "retiradas" && Array.isArray(data)) {
      headerCells = ["Doc", "Data", "Igreja", "Status", "Itens", "Total"].map((h) => `<th>${h}</th>`).join("");
      bodyRows = (data as Array<{ numeroDoc: string; dataEntrega: string; church: { name: string }; status: string; valorTotal: number; itens: unknown[] }>)
        .map((e) => `<tr><td>${e.numeroDoc}</td><td>${new Date(e.dataEntrega).toLocaleDateString("pt-BR")}</td><td>${e.church.name}</td><td>${e.status}</td><td>${e.itens.length}</td><td class="num">R$ ${fmt(e.valorTotal)}</td></tr>`)
        .join("");
    } else if (tipo === "financeiro" && Array.isArray(data)) {
      headerCells = ["Igreja", "Trimestre", "Movimentos", "Saldo"].map((h) => `<th>${h}</th>`).join("");
      bodyRows = (data as Array<{ church: { name: string }; trimestre?: { nome: string } | null; movimentos: unknown[]; saldo: number }>)
        .map((r) => `<tr><td>${r.church.name}</td><td>${r.trimestre?.nome || "–"}</td><td>${r.movimentos.length}</td><td class="${Number(r.saldo) > 0 ? "devedor" : "ok"}">R$ ${fmt(Number(r.saldo))}</td></tr>`)
        .join("");
    } else if (tipo === "inadimplencia" && Array.isArray(data)) {
      headerCells = ["Igreja", "Regional", "Trimestre", "Saldo Devedor"].map((h) => `<th>${h}</th>`).join("");
      bodyRows = (data as Array<{ church: { name: string; regional?: { name: string } | null }; trimestre?: { nome: string } | null; saldo: number }>)
        .map((r) => `<tr><td><strong>${r.church.name}</strong></td><td>${r.church.regional?.name || "–"}</td><td>${r.trimestre?.nome || "–"}</td><td class="devedor">R$ ${fmt(Number(r.saldo))}</td></tr>`)
        .join("");
    } else if (tipo === "estoque" && !Array.isArray(data)) {
      headerCells = ["Produto", "Categoria", "Trimestre", "Saldo"].map((h) => `<th>${h}</th>`).join("");
      bodyRows = ((data as { estoque: Array<{ produto: { nome: string; categoria: { nome: string }; trimestre?: { nome: string } | null }; quantidade: number }> }).estoque)
        .map((e) => `<tr><td><strong>${e.produto.nome}</strong></td><td>${e.produto.categoria.nome}</td><td>${e.produto.trimestre?.nome || "–"}</td><td class="${e.quantidade <= 10 ? "devedor" : ""}">${e.quantidade} un</td></tr>`)
        .join("");
    }

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>EBD — ${tipoLabel}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:24px}
      h1{font-size:17px;font-weight:700;margin-bottom:3px}
      .sub{font-size:10px;color:#64748b;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #cbd5e1}
      td{padding:6px 10px;border-bottom:1px solid #e2e8f0}
      tr:last-child td{border-bottom:none}
      .devedor{color:#c2410c;font-weight:700}
      .ok{color:#15803d;font-weight:700}
      .num{font-weight:600}
      @media print{@page{margin:1.5cm}}
    </style></head><body>
      <h1>Relatório EBD — ${tipoLabel}</h1>
      <p class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</p>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;

    const w = window.open("", "_blank", "width=960,height=720");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const TIPOS_LABEL: Record<ReportType, string> = {
    retiradas: "Retiradas", financeiro: "Financeiro", estoque: "Estoque", inadimplencia: "Inadimplência",
  };

  const TIPOS: Array<{ key: ReportType; label: string }> = [
    { key: "retiradas", label: "Retiradas" },
    { key: "financeiro", label: "Financeiro" },
    { key: "estoque", label: "Estoque" },
    { key: "inadimplencia", label: "Inadimplência" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg"><BarChart3 className="w-6 h-6 text-indigo-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios EBD</h1>
      </div>

      {/* Seleção do relatório */}
      <div className="flex gap-2 border-b border-slate-200">
        {TIPOS.map((t) => (
          <button key={t.key} onClick={() => { setTipo(t.key); setData(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tipo === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">Filtros</h3>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Trimestre</label>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={filterTri} onChange={(e) => setFilterTri(e.target.value)}>
              <option value="">Todos</option>
              {trimestres.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          {(tipo === "retiradas") && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Data Início</label>
                <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Data Fim</label>
                <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </>
          )}
          <button onClick={buscar} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
          </button>
          {data && (
            <>
              <button onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50">
                <Download className="w-4 h-4" /> Exportar Excel
              </button>
              <button onClick={printReport}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resultados */}
      {data && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Retiradas */}
          {tipo === "retiradas" && Array.isArray(data) && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["Doc", "Data", "Igreja", "Status", "Itens", "Total"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data as Array<{ numeroDoc: string; dataEntrega: string; church: { name: string }; status: string; valorTotal: number; itens: unknown[] }>).map((e) => (
                  <tr key={e.numeroDoc} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{e.numeroDoc}</td>
                    <td className="px-4 py-3">{new Date(e.dataEntrega).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">{e.church.name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100">{e.status}</span></td>
                    <td className="px-4 py-3">{e.itens.length}</td>
                    <td className="px-4 py-3 font-medium">R$ {fmt(e.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Financeiro */}
          {tipo === "financeiro" && Array.isArray(data) && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["Igreja", "Trimestre", "Movimentos", "Saldo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data as Array<{ church: { name: string }; trimestre?: { nome: string } | null; movimentos: unknown[]; saldo: number }>).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{r.church.name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.trimestre?.nome || "–"}</td>
                    <td className="px-4 py-3">{r.movimentos.length}</td>
                    <td className={`px-4 py-3 font-bold ${Number(r.saldo) > 0 ? "text-orange-700" : "text-green-700"}`}>R$ {fmt(Number(r.saldo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Estoque */}
          {tipo === "estoque" && !Array.isArray(data) && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["Produto", "Categoria", "Trimestre", "Saldo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {((data as { estoque: Array<{ produto: { nome: string; categoria: { nome: string }; trimestre?: { nome: string } | null }; quantidade: number }> }).estoque).map((e, i) => (
                  <tr key={i} className={`hover:bg-slate-50 ${e.quantidade <= 10 ? "bg-yellow-50/40" : ""}`}>
                    <td className="px-4 py-3 font-medium">{e.produto.nome}</td>
                    <td className="px-4 py-3">{e.produto.categoria.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{e.produto.trimestre?.nome || "–"}</td>
                    <td className={`px-4 py-3 font-bold ${e.quantidade <= 10 ? "text-red-600" : "text-slate-800"}`}>{e.quantidade} un</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Inadimplência */}
          {tipo === "inadimplencia" && Array.isArray(data) && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{["Igreja", "Regional", "Trimestre", "Saldo Devedor"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data as Array<{ church: { name: string; regional?: { name: string } | null }; trimestre?: { nome: string } | null; saldo: number }>).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.church.name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.church.regional?.name || "–"}</td>
                    <td className="px-4 py-3 text-slate-500">{r.trimestre?.nome || "–"}</td>
                    <td className="px-4 py-3 font-bold text-orange-700">R$ {fmt(Number(r.saldo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
