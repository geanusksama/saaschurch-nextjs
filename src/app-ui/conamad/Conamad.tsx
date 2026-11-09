"use client";
import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, CircleDollarSign, Download, Eye, FileText, FilterX, Landmark, Loader2, Printer, Receipt, Search, ShieldCheck, SlidersHorizontal, Upload, Users, X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { apiBase } from "../../lib/apiBase";
import { authFetch } from "../../lib/secretariaHooks";
import { fotoDisponivel } from "../../lib/fotoMembro";
import { FONTE_MODELO_FAMILIA, useFonteModelo } from "../../lib/fonteModelo";
import type { PrintOrientation } from "../../lib/printReport";
import { imprimirConamad, type ColunaImpressao } from "../../lib/conamad/impressao";
import { Permissao, usePode } from "../../lib/permissoes/Permissao";
import { PERM_SECRETARIA } from "../../lib/conamad/permissoes";
import { AvisoDefinaFiltros } from "../../components/app-ui/BotaoBuscar";
import { CartoesTotais } from "../../components/app-ui/CartoesTotais";
import { PrintModal } from "../../components/app-ui/shared/PrintModal";
import {
  AvisoFiltrosColuna, CabecalhoFiltro, EngrenagemColunas, OpcoesMarcaveis, useTabelaColunas, type ColunaTabela, type TabelaColunas,
} from "../../components/app-ui/shared/FiltroColunas";

type AbaSecretaria = "sec-cargo" | "sec-cpf" | "sec-protocolo" | "sec-ficha" | "sec-credencial" | "sec-arquivo";
type Aba = "visao" | "inadimplentes" | "anuidades" | "lista-geral" | "por-igreja" | "jubilados" | "atualizar" | "documentos" | AbaSecretaria;
type AbaConsulta = Exclude<Aba, "atualizar" | "documentos">;

const TITULOS: Record<Aba, string> = {
  visao: "Visão geral", inadimplentes: "Ministros inadimplentes", anuidades: "Anuidades",
  "lista-geral": "Anuidades (Lista geral)", "por-igreja": "Inadimplentes por igreja", jubilados: "Status de Ministro Jubilados", atualizar: "Atualizar dados", documentos: "Modelos de documentos",
  "sec-cargo": "Lista Geral - Por Cargo / Igreja", "sec-cpf": "Lista Geral CPF - Por Cargo / Igreja", "sec-protocolo": "Lista de protocolo", "sec-ficha": "Ficha Cadastral Resumida", "sec-credencial": "Credencial Emitida por Membro", "sec-arquivo": "Controle de Processo do Arquivo Digital",
};
const TIPO_API: Record<AbaConsulta, string> = { visao: "por-ano", inadimplentes: "inadimplentes", anuidades: "anuidades", "lista-geral": "lista-geral", "por-igreja": "por-igreja", jubilados: "jubilados", "sec-cargo": "ministros", "sec-cpf": "ministros", "sec-protocolo": "ministros", "sec-ficha": "ministros", "sec-credencial": "ministros", "sec-arquivo": "ministros" };

const OPCOES_ANUIDADE = ["Pago", "Não Pago", "Isento", "Cancelado"].map((s) => ({ valor: s, rotulo: s }));
const OPCOES_MINISTRO = ["ATIVO", "DESLIGADO", "AGUARDANDO ATIVACAO"].map((s) => ({ valor: s, rotulo: s }));
const OPCOES_SEXO = ["Masculino", "Feminino"].map((s) => ({ valor: s, rotulo: s }));
const OPCOES_ESTADO_CIVIL = ["Casado(a)", "Solteiro(a)", "Viúvo(a)", "Divorciado(a)", "Não informado"].map((s) => ({ valor: s, rotulo: s }));
const OPCOES_CREDENCIAL = ["VIGENTE", "VENCIDA", "SEM CREDENCIAL"].map((s) => ({ valor: s, rotulo: s }));
const OPCOES_TITULO = ["PASTOR", "PASTORA", "EVANGELISTA", "MISSIONARIA", "PASTOR PRESIDENTE", "PASTOR JUBILADO", "PASTORA JUBILADA"].map((s) => ({ valor: s, rotulo: s }));
const rotuloMinistro = (s: string | null | undefined) => s ?? "";

const brl = (v: unknown) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const COR_SITUACAO: Record<string, string> = {
  VIGENTE: "bg-emerald-100 text-emerald-700", VENCIDA: "bg-rose-100 text-rose-700", "SEM CREDENCIAL": "bg-slate-200 text-slate-600",
  Pago: "bg-emerald-100 text-emerald-700", "Não Pago": "bg-rose-100 text-rose-700", Isento: "bg-sky-100 text-sky-700", "Isento por idade": "bg-sky-100 text-sky-700", Cancelado: "bg-slate-200 text-slate-600",
  Sim: "bg-emerald-100 text-emerald-700", Não: "bg-slate-200 text-slate-600",
  ATIVO: "bg-emerald-100 text-emerald-700", DESLIGADO: "bg-rose-100 text-rose-700", "AGUARDANDO ATIVACAO": "bg-amber-100 text-amber-700",
};
const SIGLA: Record<string, string> = { Pago: "PAGO", "Não Pago": "NPAG", Isento: "ISN", "Isento por idade": "ISN/ID", Cancelado: "CANC" };

function Selo({ texto }: { texto: unknown }) {
  if (!texto) return <span className="text-slate-400">—</span>;
  const t = String(texto);
  return <span className={`inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${COR_SITUACAO[t] ?? "bg-slate-100 text-slate-700"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{t}</span>;
}

function Avatar({ nome, foto }: { nome: string; foto?: string | null }) {
  const url = fotoDisponivel(foto);
  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" className="h-[42px] w-[42px] flex-none rounded-full object-cover" />;
  return <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{iniciais}</span>;
}

type Linha = Record<string, unknown>;
type Coluna = ColunaTabela<Linha> & { larg: string; render: (l: Linha) => ReactNode; texto: (l: Linha) => string | number };

function Ministro({ l }: { l: Linha }) {
  const nome = String(l.nome ?? "");
  const detalhe = [l.rol != null ? `ROL #${l.rol}` : "Sem ROL", l.matricula != null ? `Matrícula ${l.matricula}` : ""].filter(Boolean).join(" · ");
  const miolo = (
    <>
      <Avatar nome={nome} foto={l.fotoUrl as string | null} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold group-hover:underline">{nome}</span>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{detalhe}</span>
      </span>
    </>
  );
  return l.memberId
    ? <Link to={`/app-ui/members/${l.memberId}`} title="Abrir perfil do membro" className="group flex min-w-0 flex-1 items-center gap-3">{miolo}</Link>
    : <span className="flex min-w-0 flex-1 items-center gap-3">{miolo}</span>;
}

const campo = (l: Linha, c: string) => String(l[c] ?? "");
function coluna(id: string, rotulo: string, larg: string, render: (l: Linha) => ReactNode, tipo: "texto" | "numero" = "texto", valor?: (l: Linha) => string | number): Coluna {
  const obter = valor ?? ((l: Linha) => campo(l, id));
  return { id, rotulo, larg, render, texto: obter, campos: [{ id, rotulo, valor: obter, tipo }] };
}
const textoCol = (id: string, rotulo: string, larg = "minmax(130px,1fr)") => coluna(id, rotulo, larg, (l) => <span className="truncate text-[13px]">{campo(l, id) || "—"}</span>);
const numCol = (id: string, rotulo: string, larg = "minmax(90px,.6fr)") => coluna(id, rotulo, larg, (l) => <span className="text-[13px] font-semibold">{String(l[id] ?? 0)}</span>, "numero", (l) => Number(l[id] ?? 0));
/** Data DD/MM/AAAA na tela; o filtro e a ordenação da coluna recebem AAAA-MM-DD. */
const dataIso = (t: string) => { const [d, m, a] = t.split("/"); return a ? `${a}-${m}-${d}` : null; };
const dataCol = (id: string, rotulo: string, larg = "110px"): Coluna => ({ ...textoCol(id, rotulo, larg), campos: [{ id, rotulo, valor: (l) => dataIso(campo(l, id)), tipo: "data", formatar: (v) => (v ? String(v).split("-").reverse().join("/") : "") }] });
const seloCol = (id: string, rotulo: string, larg = "minmax(170px,1fr)") => coluna(id, rotulo, larg, (l) => <Selo texto={l[id]} />);
const valorCol = (id: string, rotulo: string, cor = true) => coluna(id, rotulo, "minmax(130px,.8fr)", (l) => <span className={`whitespace-nowrap text-[13px] font-bold ${cor ? "text-rose-600" : ""}`}>{brl(l[id])}</span>, "numero", (l) => Number(l[id] ?? 0));
const colMinistro: Coluna = {
  id: "nome", rotulo: "Ministro", larg: "minmax(280px,2fr)", fixa: true, render: (l) => <Ministro l={l} />, texto: (l) => campo(l, "nome"),
  campos: [
    { id: "nome", rotulo: "Nome", valor: (l) => campo(l, "nome"), listarValores: false },
    { id: "rol", rotulo: "ROL", valor: (l) => (l.rol == null ? null : Number(l.rol)), tipo: "numero", listarValores: false },
    { id: "matricula", rotulo: "Matrícula", valor: (l) => (l.matricula == null ? null : Number(l.matricula)), tipo: "numero", listarValores: false },
  ],
};

function colunasDe(aba: AbaConsulta, linhas: Linha[]): Coluna[] {
  if (aba === "visao") return [
    { ...numCol("ano", "Ano", "minmax(90px,.6fr)"), fixa: true }, numCol("pagas", "Pagas"), numCol("naoPagas", "Não pagas"), numCol("isentas", "Isentas"), numCol("canceladas", "Canceladas"),
    valorCol("recebido", "Pago", false), valorCol("aberto", "Em aberto"),
  ];
  if (aba.startsWith("sec-")) {
    const titulo = textoCol("titulo", "Cargo", "minmax(160px,1fr)"), igreja = textoCol("igreja", "Igreja", "minmax(170px,1.2fr)"), regional = textoCol("regional", "Regional", "minmax(120px,.8fr)"), situacao = seloCol("situacao", "Situação"), sexo = textoCol("sexo", "Sexo", "100px"), cpf = textoCol("documento", "CPF", "140px");
    if (aba === "sec-cargo") return [colMinistro, titulo, sexo, igreja, regional, situacao];
    if (aba === "sec-cpf") return [colMinistro, cpf, titulo, sexo, igreja, regional, situacao];
    if (aba === "sec-protocolo") return [colMinistro, titulo, cpf, igreja, regional, situacao];
    if (aba === "sec-credencial") return [colMinistro, titulo, sexo, situacao, igreja, regional, dataCol("credencialLiberacao", "Liberação"), dataCol("credencialValidade", "Validade"), seloCol("credencialStatus", "Credencial", "minmax(140px,.9fr)")];
    if (aba === "sec-arquivo") return [colMinistro, igreja, textoCol("hierarquia", "Hierarquia", "120px"), situacao, textoCol("possuiDocumento", "Possui documento", "140px")];
    return [colMinistro, titulo, situacao, dataCol("nascimento", "Nascimento"), coluna("idade", "Idade", "70px", (l) => <span className="text-[13px] font-semibold">{l.idade == null ? "—" : String(l.idade)}</span>, "numero", (l) => (l.idade == null ? "" : Number(l.idade))), textoCol("celular", "Celular", "140px"), textoCol("estadoCivil", "Estado civil", "120px"), igreja, regional, textoCol("endereco", "Endereço", "minmax(240px,1.8fr)"), textoCol("enderecoCidade", "Cidade", "minmax(200px,1.2fr)")];
  }
  if (aba === "jubilados") return [colMinistro, textoCol("titulo", "Título", "minmax(170px,1fr)"), seloCol("situacao", "Situação"), seloCol("situacaoCadastro", "Cadastro"), textoCol("igreja", "Igreja", "minmax(170px,1.2fr)"), textoCol("estado", "Estado", "80px"), seloCol("anuidade", "Anuidade", "minmax(130px,.8fr)")];
  if (aba === "inadimplentes") return [
    colMinistro, textoCol("titulo", "Título"), seloCol("situacao", "Situação"), seloCol("situacaoCadastro", "Cadastro"), textoCol("igreja", "Igreja", "minmax(170px,1.2fr)"),
    coluna("anos", "Anos em aberto", "minmax(190px,1.4fr)", (l) => <span className="text-[13px]">{(l.anos as number[]).join(", ")}</span>, "texto", (l) => (l.anos as number[]).join(", ")),
    numCol("qtd", "Qtd", "70px"), valorCol("total", "Valor em aberto"),
  ];
  if (aba === "por-igreja") {
    const anosIgreja = [...new Set(linhas.flatMap((l) => Object.keys((l.anos as Record<string, number>) ?? {})))].sort();
    return [
      { ...textoCol("igreja", "Igreja", "minmax(260px,2fr)"), fixa: true }, numCol("totalMinistros", "Total de ministros", "130px"), numCol("ministros", "Com débito", "110px"),
      ...anosIgreja.map((a) => coluna(`ano${a}`, a, "72px", (l) => <span className="text-[13px]">{(l.anos as Record<string, number>)[a] ?? 0}</span>, "numero", (l) => (l.anos as Record<string, number>)[a] ?? 0)),
      numCol("anuidades", "Anuidades", "100px"), valorCol("total", "Valor em aberto"),
    ];
  }
  if (aba === "anuidades") return [
    colMinistro, textoCol("titulo", "Título"), seloCol("situacaoMinistro", "Situação"), textoCol("igreja", "Igreja", "minmax(170px,1.2fr)"), numCol("ano", "Ano", "80px"), valorCol("valor", "Valor", false), seloCol("anuidade", "Anuidade", "minmax(120px,.8fr)"), textoCol("motivoIsencao", "Motivo da isenção", "minmax(150px,1fr)"),
  ];
  const anos = [...new Set(linhas.flatMap((l) => Object.keys((l.anos as Record<string, string>) ?? {})))].sort();
  return [
    colMinistro, textoCol("titulo", "Título"), seloCol("situacao", "Situação"), valorCol("naoPago", "Não pago"),
    ...anos.map((a) => coluna(`ano${a}`, a, "78px", (l) => {
      const s = (l.anos as Record<string, string>)[a];
      return s ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_SITUACAO[s] ?? ""}`}>{SIGLA[s] ?? s}</span> : <span className="text-slate-300">·</span>;
    }, "texto", (l) => SIGLA[(l.anos as Record<string, string>)[a]] ?? "")),
  ];
}

const TAMANHOS = [25, 50, 100, 200];

/** Tabela igual à de Membros: filtro e ordenação por coluna, colunas e paginação. */
function TabelaPadrao({ tabela, colunas, carregou, nomeItens, painelBusca }: { tabela: TabelaColunas<Linha>; colunas: Coluna[]; carregou: boolean; nomeItens: string; painelBusca?: ReactNode }) {
  const [tamanho, setTamanho] = useState(25);
  const [pagina, setPagina] = useState(1);
  const visiveis = colunas.filter((c) => tabela.visivel(c.id));
  const grade = { gridTemplateColumns: `${visiveis.map((c) => c.larg).join(" ")} 76px` };
  const total = tabela.linhas.length;
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const atual = Math.min(pagina, paginas);
  const itens = tabela.linhas.slice((atual - 1) * tamanho, atual * tamanho);
  const botao = "h-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:border-slate-900 disabled:pointer-events-none disabled:text-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
  return (
    <section className={`relative overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 ${painelBusca ? "min-h-[360px]" : ""}`}>
      {painelBusca && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 p-4 backdrop-blur-[1px] dark:bg-slate-900/70">{painelBusca}</div>}
      {!carregou ? (painelBusca ? null : <AvisoDefinaFiltros />) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-fit">
              <div style={grade} className="grid items-center gap-4 border-b border-[#eef2f6] bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-[.04em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                {visiveis.map((c) => <span key={c.id} className="flex min-w-0"><CabecalhoFiltro tabela={tabela} colunaId={c.id} className="uppercase tracking-[.04em]" /></span>)}
                <span className="flex items-center justify-end gap-1"><span>Ações</span><EngrenagemColunas tabela={tabela} /></span>
              </div>
              {itens.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center"><span className="text-base font-bold">Nada encontrado</span><span className="text-sm text-slate-500 dark:text-slate-400">Tente outra busca ou remova algum filtro.</span></div>
              ) : itens.map((l, i) => (
                <div key={`${String(l.id ?? l.matricula ?? l.ano ?? "")}-${i}`} style={grade} className="grid items-center gap-4 border-t border-[#f1f5f9] px-5 py-3 first:border-t-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                  {visiveis.map((c) => <span key={c.id} className="flex min-w-0 items-center">{c.render(l)}</span>)}
                  <span className="flex justify-end">{l.memberId ? <Link to={`/app-ui/members/${l.memberId}`} title="Ver ficha do membro" className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><Eye className="h-[17px] w-[17px]" strokeWidth={2} /></Link> : null}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f6] px-5 py-3.5 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <span>Exibindo {total ? (atual - 1) * tamanho + 1 : 0} a {(atual - 1) * tamanho + itens.length} de {total} {nomeItens}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2"><span className="hidden sm:inline">Linhas por página</span>
                <span className="relative">
                  <select value={tamanho} onChange={(e) => { setTamanho(Number(e.target.value)); setPagina(1); }} className="h-[34px] appearance-none rounded-[10px] border border-slate-200 bg-white pl-3 pr-8 text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">{TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                </span>
              </label>
              <button type="button" disabled={atual <= 1} onClick={() => setPagina(atual - 1)} className={botao}>Anterior</button>
              <span className="flex h-[34px] min-w-[34px] items-center justify-center rounded-[10px] bg-slate-900 px-2.5 text-[13px] font-bold text-white dark:bg-white dark:text-slate-900">{atual}</span>
              <span>de {paginas}</span>
              <button type="button" disabled={atual >= paginas} onClick={() => setPagina(atual + 1)} className={botao}>Próxima</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

interface CartaoDef { rotulo: string; valor: string | number; icone: ElementType; bg: string; fg: string }
function Cartoes({ itens, carregou }: { itens: CartaoDef[]; carregou: boolean }) {
  return (
    <CartoesTotais>
      {itens.map((c) => (
        <div key={c.rotulo} className="flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] border-[#e8ecf1] bg-white py-2 pl-2 pr-3.5 dark:border-slate-700 dark:bg-slate-800">
          <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl ${c.bg} ${c.fg}`}><c.icone className="h-[19px] w-[19px]" strokeWidth={1.8} /></span>
          <span className="flex flex-col"><span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em]">{carregou ? c.valor : "—"}</span><span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">{c.rotulo}</span></span>
        </div>
      ))}
    </CartoesTotais>
  );
}

const CINZA = { bg: "bg-slate-100", fg: "text-slate-700" };
const VERDE = { bg: "bg-emerald-100", fg: "text-emerald-700" };
const VERMELHO = { bg: "bg-rose-100", fg: "text-rose-700" };
const AZUL = { bg: "bg-sky-100", fg: "text-sky-700" };
const soma = (ls: Linha[], c: string) => ls.reduce((s, l) => s + Number(l[c] || 0), 0);

function cartoesDe(aba: AbaConsulta, ls: Linha[]): CartaoDef[] {
  if (aba.startsWith("sec-")) {
    const conta = (c: string, v: string) => ls.filter((l) => l[c] === v).length;
    if (aba === "sec-credencial") return [{ rotulo: "Ministros", valor: ls.length, icone: Users, ...CINZA }, { rotulo: "Vigentes", valor: conta("credencialStatus", "VIGENTE"), icone: CheckCircle2, ...VERDE }, { rotulo: "Vencidas", valor: conta("credencialStatus", "VENCIDA"), icone: AlertTriangle, ...VERMELHO }, { rotulo: "Sem credencial", valor: conta("credencialStatus", "SEM CREDENCIAL"), icone: Receipt, ...CINZA }];
    return [{ rotulo: "Ministros", valor: ls.length, icone: Users, ...CINZA }, { rotulo: "Ativos", valor: conta("situacao", "ATIVO"), icone: CheckCircle2, ...VERDE }, { rotulo: "Desligados", valor: conta("situacao", "DESLIGADO"), icone: AlertTriangle, ...VERMELHO }];
  }
  if (aba === "jubilados") return [{ rotulo: "Ministros", valor: ls.length, icone: Users, ...CINZA }, { rotulo: "Isentos", valor: ls.filter((l) => l.anuidade === "Isento").length, icone: ShieldCheck, ...AZUL }, { rotulo: "Sem anuidade", valor: ls.filter((l) => l.anuidade === "Sem anuidade").length, icone: Receipt, ...CINZA }];
  if (aba === "visao") return [
    { rotulo: "Pagas", valor: soma(ls, "pagas"), icone: CheckCircle2, ...VERDE }, { rotulo: "Não pagas", valor: soma(ls, "naoPagas"), icone: AlertTriangle, ...VERMELHO },
    { rotulo: "Isentas", valor: soma(ls, "isentas"), icone: ShieldCheck, ...AZUL }, { rotulo: "Em aberto", valor: brl(soma(ls, "aberto")), icone: CircleDollarSign, ...VERMELHO },
  ];
  if (aba === "inadimplentes") return [
    { rotulo: "Ministros", valor: ls.length, icone: Users, ...CINZA }, { rotulo: "Anuidades", valor: soma(ls, "qtd"), icone: Receipt, ...AZUL }, { rotulo: "Em aberto", valor: brl(soma(ls, "total")), icone: CircleDollarSign, ...VERMELHO },
  ];
  if (aba === "por-igreja") return [
    { rotulo: "Igrejas", valor: ls.length, icone: Building2, ...CINZA }, { rotulo: "Ministros", valor: soma(ls, "ministros"), icone: Users, ...AZUL }, { rotulo: "Em aberto", valor: brl(soma(ls, "total")), icone: CircleDollarSign, ...VERMELHO },
  ];
  if (aba === "anuidades") {
    const naoPagas = ls.filter((l) => l.anuidade === "Não Pago");
    return [
      { rotulo: "Anuidades", valor: ls.length, icone: Receipt, ...CINZA }, { rotulo: "Pagas", valor: ls.filter((l) => l.anuidade === "Pago").length, icone: CheckCircle2, ...VERDE },
      { rotulo: "Não pagas", valor: naoPagas.length, icone: AlertTriangle, ...VERMELHO }, { rotulo: "Em aberto", valor: brl(soma(naoPagas, "valor")), icone: CircleDollarSign, ...VERMELHO },
    ];
  }
  return [
    { rotulo: "Ministros", valor: ls.length, icone: Users, ...CINZA }, { rotulo: "Com débito", valor: ls.filter((l) => Number(l.naoPago) > 0).length, icone: AlertTriangle, ...VERMELHO }, { rotulo: "Em aberto", valor: brl(soma(ls, "naoPago")), icone: CircleDollarSign, ...VERMELHO },
  ];
}

interface Filtros { anos: string[] | null; situacoes: string[] | null; situacoesMinistro: string[] | null; titulos: string[] | null; sexos: string[] | null; estadosCivis: string[] | null; regionais: string[] | null; credenciais: string[] | null }
const FILTROS_VAZIOS: Filtros = { anos: null, situacoes: null, situacoesMinistro: null, titulos: null, sexos: null, estadosCivis: null, regionais: null, credenciais: null };

/** Mostra, no lugar dos dados, o que foi pedido enquanto a consulta roda. */
function PainelBusca({ itens }: { itens: Array<[string, string]> }) {
  return (
    <div role="status" className="w-[min(420px,100%)] rounded-[18px] border border-[#e8ecf1] bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3 border-b border-[#eef2f6] pb-3.5 dark:border-slate-700">
        <Loader2 className="h-5 w-5 flex-none animate-spin text-slate-700 dark:text-slate-200" />
        <span className="text-[15px] font-extrabold">Buscando os dados...</span>
      </div>
      <dl className="mt-3.5 flex flex-col gap-2.5 text-sm">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-start justify-between gap-4">
            <dt className="flex-none text-slate-500 dark:text-slate-400">{rotulo}</dt>
            <dd className="min-w-0 text-right font-semibold">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2.5"><span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">{titulo}</span>{children}</div>;
}

/** Dropdown com caixas de marcar, como os filtros de Membros. `null` = todos. */
function DropdownMarcavel({ opcoes, valor, onChange, rotuloTodos }: { opcoes: string[]; valor: string[] | null; onChange: (v: string[] | null) => void; rotuloTodos: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const todos = valor === null;
  const marcados = valor ?? [];
  const rotulo = todos ? rotuloTodos : marcados.length === 0 ? "Nenhum selecionado" : marcados.length === 1 ? marcados[0] : `${marcados.length} selecionados`;
  const alternar = (v: string) => {
    if (todos) { onChange(opcoes.filter((o) => o !== v)); return; }
    const prox = marcados.includes(v) ? marcados.filter((x) => x !== v) : [...marcados, v];
    onChange(prox.length === opcoes.length ? null : prox);
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto((p) => !p)} className="flex h-[50px] w-full items-center justify-between gap-1 rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-left text-[15px] font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
        <span className="truncate">{rotulo}</span><ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-[14px] border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <label className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><input type="checkbox" checked={todos} onChange={() => onChange(todos ? [] : null)} className="h-4 w-4 rounded border-slate-300 accent-slate-900" />{rotuloTodos}</label>
          {opcoes.map((o) => <label key={o} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" checked={todos || marcados.includes(o)} onChange={() => alternar(o)} className="h-4 w-4 rounded border-slate-300 accent-slate-900" />{o}</label>)}
        </div>
      )}
    </div>
  );
}

function Pagina({ aba, acoes, titulo, secao, children }: { aba: Aba; acoes?: ReactNode; titulo?: string; secao?: string; children: ReactNode }) {
  useFonteModelo();
  return (
    <div className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
      <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-700 dark:text-slate-200"><Landmark className="h-5 w-5" strokeWidth={1.8} /></div>
          <div className="flex min-w-0 flex-col gap-0.5"><span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">{secao ?? "Conamad"}</span><span className="whitespace-nowrap text-[17px] font-bold">{titulo ?? TITULOS[aba]}</span></div>
        </div>
        <div className="flex items-center gap-2">{acoes}</div>
      </header>
      <div className="flex flex-col gap-4 p-4 md:px-7 md:py-5">{children}</div>
    </div>
  );
}

const btnTopo = "flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

function Consulta({ aba, topo, titulo, secao }: { aba: AbaConsulta; topo?: ReactNode; titulo?: string; secao?: string }) {
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const [busca, setBusca] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [imprimir, setImprimir] = useState(false);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [anos, setAnos] = useState<string[]>([]);
  const ultimoPedido = useRef(0);

  const [regionais, setRegionais] = useState<string[]>([]);
  const ehSecretaria = aba.startsWith("sec-");
  useEffect(() => {
    if (ehSecretaria) authFetch<string[]>(`${apiBase}/conamad?tipo=regionais`).then(setRegionais).catch(() => undefined);
    else authFetch<number[]>(`${apiBase}/conamad?tipo=anos`).then((a) => setAnos(a.map(String))).catch(() => undefined);
  }, [ehSecretaria]);

  const colunas = useMemo(() => colunasDe(aba, linhas ?? []), [aba, linhas]);
  const tabela = useTabelaColunas<Linha>({ chave: `conamad.${aba}`, colunas, linhas: linhas ?? [] });
  const ativos = Object.values(f).filter((v) => v !== null).length;
  const temPessoa = aba !== "visao" && aba !== "por-igreja";
  const carregou = linhas !== null;
  const filtradas = tabela.linhas;

  const buscar = async () => {
    const pedido = ++ultimoPedido.current;
    // "Nenhum selecionado" num filtro: o resultado é vazio, sem consultar.
    if (Object.values(f).some((v) => v && v.length === 0)) { setErro(""); setDrawer(false); setBuscando(false); setLinhas([]); return; }
    setBuscando(true); setErro(""); setDrawer(false);
    const p = new URLSearchParams({ tipo: TIPO_API[aba] });
    if (busca.trim()) p.set("busca", busca.trim());
    if (ehSecretaria) p.set("rel", aba);
    Object.entries(f).forEach(([k, v]) => {
      if (!v || !v.length) return;
      if (k === "regionais") v.forEach((x: string) => p.append(k, x));
      else p.set(k, v.join(","));
    });
    try {
      const r = await authFetch<Linha[]>(`${apiBase}/conamad?${p}`);
      if (pedido === ultimoPedido.current) setLinhas(r);
    } catch (e) {
      if (pedido === ultimoPedido.current) setErro(e instanceof Error ? e.message : "Não foi possível consultar.");
    } finally {
      if (pedido === ultimoPedido.current) setBuscando(false);
    }
  };

  const limpar = () => { setF(FILTROS_VAZIOS); setBusca(""); };
  const escolhidos = (v: string[] | null, opcoes?: Array<{ valor: string; rotulo: string }>) => (v === null ? "Todos" : v.length ? v.map((x) => opcoes?.find((o) => o.valor === x)?.rotulo ?? x).join(", ") : "Nenhum");
  const itensBusca: Array<[string, string]> = [
    ["Relatório", TITULOS[aba]],
    ...(busca.trim() ? [["Busca", busca.trim()] as [string, string]] : []),
    ...(aba !== "jubilados" && !ehSecretaria ? [["Ano", escolhidos(f.anos)] as [string, string]] : []),
    ...(ehSecretaria ? [["Sexo", escolhidos(f.sexos)] as [string, string], ["Regional", escolhidos(f.regionais)] as [string, string]] : []),
    ...(aba === "anuidades" ? [["Anuidade", escolhidos(f.situacoes)] as [string, string]] : []),
    ["Situação do ministro", escolhidos(f.situacoesMinistro, OPCOES_MINISTRO)],
    ["Título", escolhidos(f.titulos, OPCOES_TITULO)],
  ];
  const colsSaida = colunas.filter((c) => tabela.visivel(c.id));
  const extras = temPessoa ? [{ id: "rol", rotulo: "ROL", texto: (l: Linha) => (l.rol == null ? "" : Number(l.rol)) }, { id: "matricula", rotulo: "Matrícula", texto: (l: Linha) => Number(l.matricula) }] : [];
  const saida = [...extras, ...colsSaida.map((c) => ({ id: c.id, rotulo: c.rotulo, texto: c.texto }))];

  const baixar = () => {
    if (!filtradas.length) return;
    const ws = XLSX.utils.aoa_to_sheet([saida.map((c) => c.rotulo), ...filtradas.map((l) => saida.map((c) => c.texto(l)))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conamad");
    XLSX.writeFile(wb, `conamad_${aba}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const dinheiro = new Set(["total", "valor", "naoPago", "aberto", "recebido"]);
  // Ordem do modelo da convenção: matrícula, título e nome primeiro.
  const prioridade = (id: string) => ["matricula", "rol", "titulo", "nome"].indexOf(id);
  const saidaImpressa = [...saida].sort((a, b) => {
    const pa = prioridade(a.id), pb = prioridade(b.id);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });
  const direita = new Set([...dinheiro, "qtd", "ministros", "anuidades", "pagas", "naoPagas", "isentas", "canceladas"]);
  const gerarImpressao = (orientation: PrintOrientation, ordem: string, cols: string[], grupo?: boolean | string) => {
    setImprimir(false);
    const def = saida.find((c) => c.id === ordem);
    const ordenadas = def ? [...filtradas].sort((a, b) => { const x = def.texto(a), y = def.texto(b); if (typeof x === "number" && typeof y === "number") return x - y; const dx = dataIso(String(x)), dy = dataIso(String(y)); return dx && dy ? dx.localeCompare(dy) : String(x).localeCompare(String(y), "pt-BR"); }) : filtradas;
    const colunasImp: ColunaImpressao[] = saidaImpressa.filter((c) => cols.includes(c.id)).map((c) => ({
      chave: c.id, rotulo: c.rotulo, alinhar: direita.has(c.id) ? "direita" : /^ano\d/.test(c.id) ? "centro" : undefined,
    }));
    const igrejas = [...new Set(filtradas.map((l) => campo(l, "igreja")).filter(Boolean))];
    imprimirConamad({
      titulo: TITULOS[aba],
      orientacao: orientation,
      colunas: colunasImp,
      linhas: ordenadas.map((l) => Object.fromEntries(saida.map((c) => {
        const v = c.texto(l);
        return [c.id, dinheiro.has(c.id) ? Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : String(v ?? "")];
      }))),
      agruparPor: typeof grupo === "string" && grupo ? grupo : undefined,
      subtitulo: igrejas.length === 1 ? igrejas[0] : undefined,
    });
  };
  const grupos = saida.filter((c) => ["titulo", "situacao", "situacaoMinistro", "situacaoCadastro", "igreja", "ano", "anuidade", "estado", "regional", "sexo", "estadoCivil", "credencialStatus", "hierarquia"].includes(c.id)).map((c) => ({ value: c.id, label: c.rotulo }));

  const acoes = (
    <>
      <Permissao chave="conamad.relatorios.imprimir" rotulo="Imprimir — Conamad" herda="conamad.view">
        <button type="button" onClick={() => setImprimir(true)} disabled={!filtradas.length} title="Imprimir" className={btnTopo}><Printer className="h-4 w-4" strokeWidth={2} /><span className="hidden md:inline">Imprimir</span></button>
      </Permissao>
      <Permissao chave="conamad.relatorios.exportar" rotulo="Exportar Excel — Conamad" herda="conamad.view">
        <button type="button" onClick={baixar} disabled={!filtradas.length} title="Exportar Excel" className={btnTopo}><Download className="h-4 w-4" strokeWidth={2} /><span className="hidden md:inline">Exportar Excel</span></button>
      </Permissao>
    </>
  );

  return (
    <Pagina aba={aba} acoes={acoes} titulo={titulo} secao={secao}>
      {topo}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex min-w-0 flex-[1_1_380px] gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }} placeholder="Nome, matrícula ou CPF" className="h-full min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <button type="button" onClick={() => setDrawer(true)} title="Filtros" className={`flex min-h-[52px] flex-none items-center gap-2 rounded-2xl border-[1.5px] bg-white px-[15px] text-sm font-semibold text-slate-900 hover:border-slate-900 md:px-[18px] dark:bg-slate-800 dark:text-slate-100 ${ativos ? "border-slate-900 dark:border-slate-300" : "border-slate-200 dark:border-slate-600"}`}>
            <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={2} /><span className="hidden md:inline">Filtros</span>
            {ativos > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">{ativos}</span>}
          </button>
          {(ativos > 0 || busca) && <button type="button" onClick={limpar} title="Limpar filtros (aplica no Buscar)" aria-label="Limpar filtros" className="grid min-h-[52px] w-[52px] flex-none place-items-center rounded-2xl border-[1.5px] border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"><FilterX className="h-[19px] w-[19px]" /></button>}
          <button type="button" onClick={() => void buscar()} disabled={buscando} title="Buscar" className="flex min-h-[52px] flex-none items-center gap-2 rounded-2xl bg-slate-900 px-[15px] text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:px-[18px] dark:bg-white dark:text-slate-900">
            {buscando ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Search className="h-[19px] w-[19px]" strokeWidth={2.2} />}<span className="hidden md:inline">{buscando ? "Buscando..." : "Buscar"}</span>
          </button>
        </div>
        <Cartoes itens={cartoesDe(aba, filtradas)} carregou={carregou} />
      </div>

      {erro && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {carregou && linhas.length >= 10000 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">Limite de 10000 linhas atingido: os totais estão parciais. Filtre por ano para ver tudo.</div>}
      {carregou && <AvisoFiltrosColuna tabela={tabela} total={linhas.length} filtradas={filtradas.length} />}

      <TabelaPadrao tabela={tabela} colunas={colunas} carregou={carregou} nomeItens="registros" painelBusca={buscando ? <PainelBusca itens={itensBusca} /> : undefined} />

      {imprimir && (
        <PrintModal open onClose={() => setImprimir(false)} onPrint={gerarImpressao}
          sortOptions={saida.map((c) => ({ value: c.id, label: c.rotulo }))}
          columnOptions={saidaImpressa.map((c) => ({ value: c.id, label: c.rotulo, defaultChecked: !(aba === "lista-geral" && (c.id === "rol" || c.id === "situacao")) }))}
          defaultSort={saida.find((c) => c.id === "nome")?.id ?? saida[0]?.id}
          groupOptions={grupos}
          defaultOrientation="landscape"
        />
      )}

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[min(440px,100%)] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(15,23,42,.35)] dark:bg-slate-800">
            <div className="flex items-center gap-3.5 border-b border-[#eef2f6] px-[22px] py-5 dark:border-slate-700">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-slate-900"><SlidersHorizontal className="h-[22px] w-[22px]" strokeWidth={2} /></span>
              <div className="flex flex-1 flex-col gap-0.5"><span className="text-lg font-extrabold">Filtros</span><span className="text-[13px] text-slate-500 dark:text-slate-400">Refine o que aparece na lista</span></div>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><X className="h-5 w-5" strokeWidth={2} /></button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-[22px]">
              {aba !== "jubilados" && !ehSecretaria && <Secao titulo="ANO"><DropdownMarcavel opcoes={anos} valor={f.anos} onChange={(v) => setF({ ...f, anos: v })} rotuloTodos="Todos os anos" /></Secao>}
              {aba === "anuidades" && <Secao titulo="ANUIDADE"><OpcoesMarcaveis opcoes={OPCOES_ANUIDADE} selecionados={f.situacoes} onChange={(v) => setF({ ...f, situacoes: v })} /></Secao>}
              <Secao titulo="SITUAÇÃO DO MINISTRO"><OpcoesMarcaveis opcoes={OPCOES_MINISTRO} selecionados={f.situacoesMinistro} onChange={(v) => setF({ ...f, situacoesMinistro: v })} /></Secao>
              <Secao titulo="TÍTULO"><OpcoesMarcaveis opcoes={OPCOES_TITULO} selecionados={f.titulos} onChange={(v) => setF({ ...f, titulos: v })} /></Secao>
              {ehSecretaria && (
                <>
                  <Secao titulo="REGIONAL"><DropdownMarcavel opcoes={regionais} valor={f.regionais} onChange={(v) => setF({ ...f, regionais: v })} rotuloTodos="Todas as regionais" /></Secao>
                  <Secao titulo="SEXO"><OpcoesMarcaveis opcoes={OPCOES_SEXO} selecionados={f.sexos} onChange={(v) => setF({ ...f, sexos: v })} /></Secao>
                  <Secao titulo="ESTADO CIVIL"><OpcoesMarcaveis opcoes={OPCOES_ESTADO_CIVIL} selecionados={f.estadosCivis} onChange={(v) => setF({ ...f, estadosCivis: v })} /></Secao>
                  {aba === "sec-credencial" && <Secao titulo="CREDENCIAL"><OpcoesMarcaveis opcoes={OPCOES_CREDENCIAL} selecionados={f.credenciais} onChange={(v) => setF({ ...f, credenciais: v })} /></Secao>}
                </>
              )}
            </div>
            <div className="flex gap-2 border-t border-[#eef2f6] p-4 dark:border-slate-700">
              <button type="button" onClick={() => setF(FILTROS_VAZIOS)} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold dark:border-slate-600">Limpar</button>
              <button type="button" onClick={() => void buscar()} className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Buscar</button>
            </div>
          </aside>
        </div>
      )}
    </Pagina>
  );
}

function TabelaPrevia({ chave, colunas, linhas, nomeItens }: { chave: string; colunas: Coluna[]; linhas: Linha[]; nomeItens: string }) {
  const tabela = useTabelaColunas<Linha>({ chave: `conamad.previa.${chave}`, colunas, linhas });
  return <TabelaPadrao tabela={tabela} colunas={colunas} carregou nomeItens={nomeItens} />;
}

const colMat = numCol("matricula", "Matrícula", "110px");
const colNome = { ...textoCol("nome", "Ministro", "minmax(260px,2fr)"), fixa: true };
const COLS_ANUIDADES = [colMat, colNome, numCol("ano", "Ano", "80px"), seloCol("de", "Aqui"), seloCol("para", "Planilha")];
const COLS_MINISTROS = [colMat, colNome, seloCol("deR", "Aqui"), seloCol("paraR", "Planilha")];
const COLS_CADASTRO = [colMat, numCol("rol", "ROL", "90px"), colNome, seloCol("conamadR", "CONAMAD"), seloCol("aqui", "Cadastro")];
const COLS_DUVIDAS = [textoCol("matricula", "Matrícula", "110px"), colNome, textoCol("motivo", "Motivo", "minmax(240px,2fr)")];

interface Previa {
  tipo: string; linhas: number; iguais: number; assinatura: string;
  mudancasAnuidades: Linha[];
  mudancasMinistros: Array<Linha & { de: string | null; para: string }>;
  divergenciasCadastro: Array<Linha & { conamad: string }>;
  duvidas: Linha[];
}

const LIMITE_ENVIO = 4 * 1024 * 1024;

/** Lê o Excel aqui no navegador: o servidor recebe só as linhas. */
async function lerPlanilha(arquivo: File): Promise<Linha[]> {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(new Uint8Array(await arquivo.arrayBuffer()), { type: "array", sheetRows: 20002 }); }
  catch { throw new Error("Arquivo inválido ou corrompido. Envie o Excel gerado pelo CONAMAD."); }
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) throw new Error("Planilha vazia.");
  return XLSX.utils.sheet_to_json<Linha>(aba, { defval: "" });
}

function Atualizar() {
  const entrada = useRef<HTMLInputElement>(null);
  const [dados, setDados] = useState<{ nome: string; linhas: Linha[] } | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const enviar = async (acao: "previa" | "aplicar", d: { nome: string; linhas: Linha[] }) => {
    setOcupado(true); setErro(""); setOk("");
    try {
      const body = JSON.stringify({ acao, nomeArquivo: d.nome, assinatura: previa?.assinatura, linhas: d.linhas });
      if (body.length > LIMITE_ENVIO) throw new Error("Planilha grande demais para enviar de uma vez. Gere por igreja ou região.");
      const r = await authFetch<Previa & { anuidades?: number; ministros?: number }>(`${apiBase}/conamad/importar`, { method: "POST", body });
      if (acao === "previa") { setDados(d); setPrevia(r); }
      else { setPrevia(null); setDados(null); setOk(`Atualização concluída: ${r.anuidades ?? 0} anuidade(s) e ${r.ministros ?? 0} ministro(s).`); }
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível processar."); }
    finally { setOcupado(false); }
  };

  const total = previa ? previa.mudancasAnuidades.length + previa.mudancasMinistros.length : 0;
  return (
    <Pagina aba="atualizar">
      <div className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-300">No CONAMAD, gere em <strong>Excel</strong> o relatório <strong>Anuidades (Lista geral)</strong> ou <strong>Lista Geral Simplificada /c Endereço</strong> e envie aqui. Nada é gravado antes da sua confirmação.</p>
        <input ref={entrada} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setPrevia(null); setDados(null); setErro(""); lerPlanilha(f).then((linhas) => enviar("previa", { nome: f.name, linhas })).catch((x) => setErro(x instanceof Error ? x.message : "Não foi possível ler o arquivo.")); } }} />
        <Permissao chave="conamad.atualizar.importar" rotulo="Importar planilha — Conamad" herda="conamad.view">
          <button type="button" disabled={ocupado} onClick={() => entrada.current?.click()} className="mt-4 flex min-h-[52px] items-center gap-2 rounded-2xl bg-slate-900 px-[18px] text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{ocupado ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Upload className="h-[19px] w-[19px]" />} Enviar planilha e comparar</button>
        </Permissao>
      </div>
      {erro && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {ok && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{ok}</div>}
      {previa && (
        <>
          <Cartoes carregou itens={[
            { rotulo: "Linhas na planilha", valor: previa.linhas, icone: Receipt, ...CINZA }, { rotulo: "Sem alteração", valor: previa.iguais, icone: CheckCircle2, ...VERDE },
            { rotulo: "Serão atualizados", valor: total, icone: Upload, ...AZUL }, { rotulo: "Em dúvida (ignorados)", valor: previa.duvidas.length, icone: AlertTriangle, ...VERMELHO },
          ]} />
          {previa.mudancasAnuidades.length > 0 && <TabelaPrevia chave="anuidades" colunas={COLS_ANUIDADES} linhas={previa.mudancasAnuidades} nomeItens="mudanças" />}
          {previa.mudancasMinistros.length > 0 && <TabelaPrevia chave="ministros" colunas={COLS_MINISTROS} linhas={previa.mudancasMinistros.map((m) => ({ ...m, deR: rotuloMinistro(m.de), paraR: rotuloMinistro(m.para) }))} nomeItens="mudanças" />}
          {previa.divergenciasCadastro.length > 0 && (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Situação diferente no cadastro (só informativo, não será alterada)</p>
              <TabelaPrevia chave="cadastro" colunas={COLS_CADASTRO} linhas={previa.divergenciasCadastro.map((d) => ({ ...d, conamadR: rotuloMinistro(d.conamad) }))} nomeItens="ministros" />
            </>
          )}
          {previa.duvidas.length > 0 && <TabelaPrevia chave="duvidas" colunas={COLS_DUVIDAS} linhas={previa.duvidas} nomeItens="dúvidas" />}
          {total > 0 && dados && (
            <Permissao chave="conamad.atualizar.aplicar" rotulo="Confirmar atualização — Conamad" herda="conamad.atualizar.importar">
              <button type="button" disabled={ocupado} onClick={() => void enviar("aplicar", dados)} className="flex min-h-[52px] w-fit items-center gap-2 rounded-2xl bg-emerald-600 px-[18px] text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-[19px] w-[19px]" /> Confirmar {total} atualização(ões)</button>
            </Permissao>
          )}
        </>
      )}
    </Pagina>
  );
}

/** Todos os modelos listados no sistema da convenção (ativos e não), com os mesmos nomes. */
const MODELOS_DOCUMENTOS: Linha[] = ([
  ["Igreja", "ATA REUNIAO", true], ["Execucao", "Comprovante", true], ["InscricaoEvento", "Comprovante de inscrição", true], ["Membro", "Ficha Cadastral", true], ["Receita", "Recibo", true], ["Receita", "Recibo", false], ["Debito", "Recibo de anuidade", true], ["Despesa", "Recibo de Despesa", true], ["ProcessoBatismo", "Senha", true], ["ProcessoConsagracao", "Senha Consagração", true], ["ProcessoConsagracao", "Senha QR Code v1", true], ["ProcessoConsagracao", "Senha QR Code v2", false], ["ProcessoConsagracao", "Senha QR Code2", false],
] as Array<[string, string, boolean]>).map(([contexto, modelo, ativo]) => ({ contexto, modelo, ativo: ativo ? "Sim" : "Não" }));
const COLS_MODELOS: Coluna[] = [textoCol("contexto", "Contexto", "minmax(180px,1fr)"), { ...textoCol("modelo", "Modelo", "minmax(260px,2fr)"), fixa: true }, seloCol("ativo", "Ativo", "120px")];
const semAcento = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function ModelosDocumentos() {
  const [busca, setBusca] = useState("");
  const linhas = useMemo(() => MODELOS_DOCUMENTOS.filter((l) => semAcento(l.modelo).includes(semAcento(busca.trim()))), [busca]);
  const tabela = useTabelaColunas<Linha>({ chave: "conamad.documentos", colunas: COLS_MODELOS, linhas });
  return (
    <Pagina aba="documentos" secao="Conamad · Documento">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="relative min-w-0 flex-[1_1_380px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtre pelo nome" className="h-full min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <Cartoes carregou itens={[{ rotulo: "Modelos", valor: tabela.linhas.length, icone: FileText, ...CINZA }, { rotulo: "Ativos", valor: tabela.linhas.filter((l) => l.ativo === "Sim").length, icone: CheckCircle2, ...VERDE }]} />
      </div>
      <TabelaPadrao tabela={tabela} colunas={COLS_MODELOS} carregou nomeItens="modelos" />
    </Pagina>
  );
}

const RELATORIOS_TESOURARIA: Array<{ aba: AbaConsulta; nome: string }> = [
  { aba: "lista-geral", nome: "Anuidades (Lista geral)" },
  { aba: "por-igreja", nome: "Inadimplentes por igreja" },
  { aba: "inadimplentes", nome: "Ministros inadimplentes" },
  { aba: "jubilados", nome: "Status de Ministro Jubilados" },
];

const RELATORIOS_SECRETARIA: Array<{ aba: AbaConsulta; nome: string }> = [
  { aba: "sec-arquivo", nome: "Controle de Processo do Arquivo Digital" },
  { aba: "sec-credencial", nome: "Credencial Emitida por Membro" },
  { aba: "sec-ficha", nome: "Ficha Cadastral Resumida" },
  { aba: "sec-protocolo", nome: "Lista de protocolo" },
  { aba: "sec-cargo", nome: "Lista Geral - Por Cargo / Igreja" },
  { aba: "sec-cpf", nome: "Lista Geral CPF - Por Cargo / Igreja" },
];

function SeletorRelatorio({ grupo, lista, valor, onChange, bloqueado }: { grupo: string; lista: Array<{ aba: AbaConsulta; nome: string }>; valor: string; onChange: (v: string) => void; bloqueado: (aba: AbaConsulta) => boolean }) {
  const campo = "h-[50px] w-full rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-[15px] font-medium text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  return (
    <div className="grid grid-cols-1 gap-3 rounded-[18px] border border-[#e8ecf1] bg-white p-4 md:grid-cols-[minmax(200px,1fr)_minmax(280px,2fr)] md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
      <label className="flex flex-col gap-1.5 text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">GRUPO
        <select className={campo} value={grupo} disabled><option value={grupo}>{grupo}</option></select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">RELATÓRIO
        <select className={campo} value={valor} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione...</option>
          {lista.map((r) => <option key={r.aba} value={r.aba}>{bloqueado(r.aba) ? `🔒 ${r.nome}` : r.nome}</option>)}
        </select>
      </label>
    </div>
  );
}

function Relatorios({ modulo }: { modulo: "secretaria" | "tesouraria" }) {
  const [params, setParams] = useSearchParams();
  const rel = params.get("rel") ?? "";
  const lista = modulo === "secretaria" ? RELATORIOS_SECRETARIA : RELATORIOS_TESOURARIA;
  const titulo = modulo === "secretaria" ? "Relatórios de Secretaria" : "Relatórios de Tesouraria";
  const atual = lista.find((r) => r.aba === rel);
  const pode = usePode();
  const bloqueado = (aba: AbaConsulta) => Object.hasOwn(PERM_SECRETARIA, aba) && !pode(PERM_SECRETARIA[aba].chave);
  const seletor = <SeletorRelatorio grupo={modulo === "secretaria" ? "Ministros" : "Anuidades"} lista={lista} valor={atual?.aba ?? ""} onChange={(v) => setParams(v ? { rel: v } : {})} bloqueado={bloqueado} />;
  if (atual && !bloqueado(atual.aba)) return <Consulta key={atual.aba} aba={atual.aba} topo={seletor} titulo={titulo} secao="Conamad · Relatórios" />;
  return (
    <Pagina aba="visao" titulo={titulo} secao="Conamad · Relatórios">
      {seletor}
      <div className="rounded-[18px] border border-[#e8ecf1] bg-white px-6 py-10 text-center text-sm text-slate-500 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{atual ? "Você não tem permissão para este relatório. Peça a liberação ao administrador." : "Selecione um relatório."}</div>
    </Pagina>
  );
}

function abaDoCaminho(caminho: string): Aba {
  const fim = caminho.replace(/\/+$/, "").split("/").pop();
  return fim === "inadimplentes" || fim === "anuidades" || fim === "lista-geral" || fim === "por-igreja" || fim === "jubilados" || fim === "atualizar" || fim === "documentos" ? fim : "visao";
}

export default function Conamad() {
  const caminho = useLocation().pathname;
  const aba = abaDoCaminho(caminho);
  if (caminho.includes("/conamad/relatorios/")) return <Relatorios key={caminho} modulo={caminho.endsWith("secretaria") ? "secretaria" : "tesouraria"} />;
  if (aba === "documentos") return <ModelosDocumentos />;
  return aba === "atualizar" ? <Atualizar /> : <Consulta key={aba} aba={aba} />;
}
