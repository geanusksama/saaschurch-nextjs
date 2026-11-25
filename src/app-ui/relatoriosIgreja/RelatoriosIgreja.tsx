"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Download, FilterX, Loader2, Lock, Printer, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";
import { Permissao, usePode } from "../../lib/permissoes/Permissao";
import { GRUPOS, permissaoGrupo } from "../../lib/relatoriosIgreja/catalogo";
import { formatar, imprimirRelatorio, totaisDe } from "../../lib/relatoriosIgreja/impressao";
import type { FiltroDef, GrupoDef, Linha, Modulo, Opcao, RelatorioDef, Resultado } from "../../lib/relatoriosIgreja/tipos";

/**
 * Relatórios de Secretaria / Tesouraria: Grupo → Relatório → Filtros, como na
 * origem. Grupo, relatório e filtros ficam na URL e o último resultado fica na
 * sessão: voltar para a tela (de uma ficha, por exemplo) não perde a lista.
 */

type Listas = Record<string, Opcao[]>;
const campo = "h-[44px] w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const rotulo = "flex flex-col gap-1.5 text-xs font-bold tracking-[.04em] text-slate-500 dark:text-slate-400";
const btn = "flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

const RESERVADOS = ["grupo", "rel"];
/** O cache é por usuário e campo ativo: trocar de campo nunca mostra resultado do outro. */
function chaveCache(modulo: Modulo, qs: string) {
  let dono = "";
  try { const u = JSON.parse(localStorage.getItem("mrm_user") || "{}") as { id?: string; campoId?: string }; dono = `${u.id ?? ""}:${u.campoId ?? ""}`; } catch { /* sem usuário salvo */ }
  return `relatoriosIgreja:${dono}:${modulo}:${qs}`;
}

function padroes(grupo: GrupoDef): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of grupo.filtros) {
    if (f.padrao != null) v[f.id] = f.padrao;
    if (f.tipo === "texto_modo") v[`${f.id}_modo`] = f.opcoes?.[0]?.valor ?? "comeca";
  }
  return v;
}

function CampoFiltro({ f, valor, setValor, listas }: { f: FiltroDef; valor: Record<string, string>; setValor: (k: string, v: string) => void; listas: Listas }) {
  const v = valor[f.id] ?? "";
  const span = f.largura === 3 ? "md:col-span-3" : f.largura === 2 ? "md:col-span-2" : "";
  if (f.tipo === "marcar") {
    return (
      <label className={`flex items-center gap-2.5 self-end pb-3 text-sm font-semibold ${span}`}>
        <input type="checkbox" checked={v === "1"} onChange={(e) => setValor(f.id, e.target.checked ? "1" : "")} className="h-4 w-4 rounded border-slate-300 accent-slate-900" />{f.rotulo}
      </label>
    );
  }
  let controle;
  if (f.tipo === "texto" || f.tipo === "numero") controle = <input type={f.tipo === "numero" ? "number" : "text"} value={v} onChange={(e) => setValor(f.id, e.target.value)} className={campo} />;
  else if (f.tipo === "texto_modo") controle = (
    <div className="flex gap-2">
      <input type="text" value={v} onChange={(e) => setValor(f.id, e.target.value)} className={campo} />
      <select value={valor[`${f.id}_modo`] ?? "comeca"} onChange={(e) => setValor(`${f.id}_modo`, e.target.value)} className={`${campo} max-w-[170px]`}>{f.opcoes?.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}</select>
    </div>
  );
  else if (f.tipo === "data") controle = <input type="date" value={v} onChange={(e) => setValor(f.id, e.target.value)} className={campo} />;
  else if (f.tipo === "ano") controle = <input type="number" min={1900} max={2100} value={v} onChange={(e) => setValor(f.id, e.target.value)} className={campo} />;
  else {
    const opcoes = f.opcoes ?? listas[f.tipo] ?? [];
    controle = (
      <select value={v} onChange={(e) => setValor(f.id, e.target.value)} className={campo}>
        {(f.tipo !== "opcao" || !f.padrao) && <option value="">Todas</option>}
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    );
  }
  return <label className={`${rotulo} ${span}`}>{f.rotulo.toUpperCase()}{controle}</label>;
}

function Tabela({ rel, linhas, agrupar }: { rel: RelatorioDef; linhas: Linha[]; agrupar: boolean }) {
  const [limite, setLimite] = useState(500);
  const grade = { gridTemplateColumns: rel.colunas.map((c) => c.larg ?? "minmax(120px,1fr)").join(" ") };
  const dir = (tipo?: string) => (tipo === "numero" || tipo === "moeda" || tipo === "percentual" ? "justify-end text-right" : "");
  const linha = (l: Linha, i: number) => (
    <div key={i} style={grade} className="grid items-start gap-3 border-t border-[#f1f5f9] px-4 py-2 text-[13px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
      {rel.colunas.map((c) => <span key={c.id} className={`flex min-w-0 break-words ${dir(c.tipo)}`}>{formatar(c, l[c.id]) || <span className="text-slate-300">—</span>}</span>)}
    </div>
  );
  const rodape = (ls: Linha[], geral = false) => {
    const t = totaisDe(rel, ls);
    return t.length ? (
      <div className={`flex flex-wrap justify-end gap-x-6 gap-y-1 px-4 py-2 text-[13px] ${geral ? "border-t-2 border-slate-300 bg-slate-50 font-bold dark:bg-slate-900/40" : "text-slate-600 dark:text-slate-300"}`}>
        {t.map(([r, v]) => <span key={r}>{geral ? r.replace(/^Quantidade de/, "Total de") : r}: <b>{v}</b></span>)}
      </div>
    ) : null;
  };
  const visiveis = linhas.slice(0, limite);
  let corpo;
  if (agrupar && rel.agruparPor) {
    const blocos = new Map<string, Linha[]>();
    for (const l of visiveis) { const k = String(l[rel.agruparPor] ?? "—"); blocos.set(k, [...(blocos.get(k) ?? []), l]); }
    corpo = [...blocos.entries()].map(([k, ls]) => (
      <div key={k}>
        <div className="border-t border-slate-200 bg-slate-100/70 px-4 py-2 text-[13px] font-extrabold dark:border-slate-700 dark:bg-slate-900/50">{k}</div>
        {ls.map(linha)}
        {rodape(ls)}
      </div>
    ));
  } else corpo = visiveis.map(linha);
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto"><div className="min-w-fit">
        <div style={grade} className="grid items-center gap-3 border-b border-[#eef2f6] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[.04em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          {rel.colunas.map((c) => <span key={c.id} className={`flex ${dir(c.tipo)}`}>{c.rotulo}</span>)}
        </div>
        {linhas.length === 0
          ? <div className="px-6 py-14 text-center text-sm text-slate-500">Não existem dados a serem exibidos.</div>
          : corpo}
        {rodape(linhas, true)}
      </div></div>
      {linhas.length > limite && (
        <div className="flex items-center justify-between border-t border-[#eef2f6] px-4 py-3 text-[13px] text-slate-500 dark:border-slate-700">
          <span>Mostrando {limite} de {linhas.length}. A impressão e o Excel levam tudo.</span>
          <button type="button" className={btn} onClick={() => setLimite((n) => n + 500)}>Mostrar mais</button>
        </div>
      )}
    </section>
  );
}

/** `manter`: chaves da URL que são da tela em volta (ex.: a aba) e não podem se perder. */
export default function RelatoriosIgreja({ modulo, manter = [] }: { modulo: Modulo; manter?: string[] }) {
  const grupos = GRUPOS[modulo];
  const [params, setParams] = useSearchParams();
  const pode = usePode();
  const grupoId = params.get("grupo") ?? "";
  const grupo = grupos.find((g) => g.id === grupoId);
  const relId = params.get("rel") ?? grupo?.relatorios[0]?.id ?? "";
  const rel = grupo?.relatorios.find((r) => r.id === relId);
  const bloqueado = (g: GrupoDef) => { const k = permissaoGrupo(modulo, g.id); return !k || !pode(k); };

  const chaveManter = manter.join(",");
  const preservados = useMemo(() => {
    const v: Record<string, string> = {};
    for (const k of chaveManter.split(",").filter(Boolean)) { const x = params.get(k); if (x != null) v[k] = x; }
    return v;
  }, [params, chaveManter]);
  const doUrl = useMemo(() => { const v: Record<string, string> = {}; params.forEach((x, k) => { if (!RESERVADOS.includes(k) && !(k in preservados)) v[k] = x; }); return v; }, [params, preservados]);
  const [valores, setValores] = useState<Record<string, string>>(() => (grupo ? { ...padroes(grupo), ...doUrl } : doUrl));
  // Voltar/avançar do navegador trocando de grupo: os filtros passam a ser os do grupo da URL.
  const [grupoDosValores, setGrupoDosValores] = useState(grupoId);
  if (grupoDosValores !== grupoId) {
    setGrupoDosValores(grupoId);
    setValores(grupo ? { ...padroes(grupo), ...doUrl } : doUrl);
  }
  const [listas, setListas] = useState<Listas>({});
  const [fresco, setFresco] = useState<{ qs: string; r: Resultado } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const pedido = useRef(0);

  useEffect(() => { authFetch<Listas>(`${apiBase}/relatorios-igreja?modulo=${modulo}&lista=opcoes`).then(setListas).catch(() => undefined); }, [modulo]);

  // Volta para a tela com a mesma URL: reabre o último resultado sem consultar de novo.
  const qsAtual = params.toString();
  const temRelatorio = Boolean(grupo && rel);
  const resultado = useMemo<Resultado | null>(() => {
    if (!temRelatorio) return null;
    if (fresco?.qs === qsAtual) return fresco.r;
    if (typeof window === "undefined") return null;
    try { const salvo = sessionStorage.getItem(chaveCache(modulo, qsAtual)); return salvo ? (JSON.parse(salvo) as Resultado) : null; } catch { return null; }
  }, [temRelatorio, fresco, qsAtual, modulo]);

  const trocarGrupo = (id: string) => {
    const g = grupos.find((x) => x.id === id);
    setValores(g ? padroes(g) : {});
    setErro("");
    setParams(id ? { ...preservados, grupo: id, rel: g?.relatorios[0]?.id ?? "" } : preservados);
  };
  const trocarRel = (id: string) => { setParams({ ...Object.fromEntries(params), rel: id }); };
  const setValor = (k: string, v: string) => setValores((p) => ({ ...p, [k]: v }));
  const filtrosVisiveis = grupo?.filtros.filter((f) => !f.so || f.so.includes(relId)) ?? [];
  const agrupar = Boolean(rel?.agruparPor) && (grupo?.filtros.some((f) => f.id === "agrupar") ? valores.agrupar === "1" : true);

  const buscar = async () => {
    if (!grupo || !rel) return;
    const n = ++pedido.current;
    const q = new URLSearchParams({ ...preservados, grupo: grupo.id, rel: rel.id });
    for (const [k, v] of Object.entries(valores)) if (v !== "" && v != null) q.set(k, v);
    setParams(q, { replace: true });
    setBuscando(true); setErro("");
    try {
      const api = new URLSearchParams(q); api.set("modulo", modulo);
      for (const k of Object.keys(preservados)) api.delete(k);
      const r = await authFetch<Resultado>(`${apiBase}/relatorios-igreja?${api}`);
      if (n !== pedido.current) return;
      setFresco({ qs: q.toString(), r });
      try { sessionStorage.setItem(chaveCache(modulo, q.toString()), JSON.stringify(r)); } catch { /* sessão cheia: segue sem cache */ }
    } catch (e) {
      if (n === pedido.current) setErro(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      if (n === pedido.current) setBuscando(false);
    }
  };

  const textoFiltros = () => filtrosVisiveis.filter((f) => valores[f.id] && f.tipo !== "marcar" && f.id !== "ordem").map((f) => {
    const v = valores[f.id];
    const op = (f.opcoes ?? listas[f.tipo] ?? []).find((o) => o.valor === v);
    return `${f.rotulo}: ${op?.rotulo ?? v}`;
  }).join(" · ");

  const imprimir = () => { if (resultado && rel) imprimirRelatorio({ organizacao: resultado.organizacao, rel, colunas: rel.colunas, linhas: resultado.linhas, agrupar, filtrosTexto: textoFiltros() }); };
  const excel = () => {
    if (!resultado || !rel) return;
    const cols = rel.agruparPor && agrupar && !rel.colunas.some((c) => c.id === rel.agruparPor) ? [{ id: rel.agruparPor, rotulo: "Grupo" }, ...rel.colunas] : rel.colunas;
    const ws = XLSX.utils.aoa_to_sheet([cols.map((c) => c.rotulo), ...resultado.linhas.map((l) => cols.map((c) => {
      const v = l[c.id]; const t = "tipo" in c ? c.tipo : undefined;
      if (v == null || v === "") return "";
      return t === "numero" || t === "moeda" || t === "percentual" ? Number(v) : formatar(c, v);
    }))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${grupo?.nome.replace(/[^\p{L}\p{N}]+/gu, "_")}_${rel.nome.replace(/[^\p{L}\p{N}]+/gu, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-[18px] border border-[#e8ecf1] bg-white p-4 md:grid-cols-[minmax(220px,1fr)_minmax(280px,2fr)] md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
        <label className={rotulo}>GRUPO
          <select className={campo} value={grupo?.id ?? ""} onChange={(e) => trocarGrupo(e.target.value)}>
            <option value="">Selecione...</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{bloqueado(g) ? `🔒 ${g.nome}` : g.nome}</option>)}
          </select>
        </label>
        <label className={rotulo}>RELATÓRIO
          <select className={campo} value={rel?.id ?? ""} onChange={(e) => trocarRel(e.target.value)} disabled={!grupo}>
            {grupo?.relatorios.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
      </div>

      {!grupo ? (
        <div className="rounded-[18px] border border-[#e8ecf1] bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          {grupos.length ? "Selecione um grupo de relatórios." : "Nenhum relatório disponível ainda."}
        </div>
      ) : bloqueado(grupo) ? (
        <div className="flex items-center justify-center gap-2 rounded-[18px] border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          <Lock className="h-4 w-4" /> Você não tem permissão para este grupo de relatórios. Peça a liberação ao administrador.
        </div>
      ) : (
        <>
          <div className="rounded-[18px] border border-[#e8ecf1] bg-white p-4 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">FILTROS</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {filtrosVisiveis.map((f) => <CampoFiltro key={f.id} f={f} valor={valores} setValor={setValor} listas={listas} />)}
            </div>
            {rel?.nota && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{rel.nota}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className={btn} onClick={() => setValores(padroes(grupo))}><FilterX className="h-4 w-4" />Limpar</button>
              <button type="button" data-sem-permissao="só consulta; a permissão é a do grupo escolhido, conferida na tela e na rota" onClick={() => void buscar()} disabled={buscando} className="flex h-10 items-center gap-2 rounded-[10px] bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{buscando ? "Gerando..." : "Gerar relatório"}
              </button>
              {modulo === "secretaria" ? (
                <>
                  <Permissao chave="reports.relatorios_secretaria.imprimir" rotulo="Imprimir — Relatórios de Secretaria" herda="reports.relatorios_secretaria.aba"><button type="button" className={btn} disabled={!resultado?.linhas.length} onClick={imprimir}><Printer className="h-4 w-4" />Imprimir</button></Permissao>
                  <Permissao chave="reports.relatorios_secretaria.exportar" rotulo="Exportar Excel — Relatórios de Secretaria" herda="reports.relatorios_secretaria.aba"><button type="button" className={btn} disabled={!resultado?.linhas.length} onClick={excel}><Download className="h-4 w-4" />Excel</button></Permissao>
                </>
              ) : (
                <>
                  <Permissao chave="finance_reports.relatorios_tesouraria.imprimir" rotulo="Imprimir — Relatórios de Tesouraria" herda="finance_reports.relatorios_tesouraria.aba"><button type="button" className={btn} disabled={!resultado?.linhas.length} onClick={imprimir}><Printer className="h-4 w-4" />Imprimir</button></Permissao>
                  <Permissao chave="finance_reports.relatorios_tesouraria.exportar" rotulo="Exportar Excel — Relatórios de Tesouraria" herda="finance_reports.relatorios_tesouraria.aba"><button type="button" className={btn} disabled={!resultado?.linhas.length} onClick={excel}><Download className="h-4 w-4" />Excel</button></Permissao>
                </>
              )}
            </div>
          </div>

          {erro && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
          {resultado?.aviso && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{resultado.aviso}</div>}
          {resultado && rel && (
            <>
              <div className="px-1">
                <div className="text-[15px] font-extrabold">{resultado.organizacao}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{rel.titulo ?? rel.nome}</div>
              </div>
              <Tabela rel={rel} linhas={resultado.linhas} agrupar={agrupar} />
            </>
          )}
        </>
      )}
    </div>
  );
}
