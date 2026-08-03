"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Reorder, AnimatePresence, motion } from "motion/react";
import {
  GripVertical, Trash2, Plus, X, Eye, EyeOff, Save, Rocket, ExternalLink,
  Palette, Check, Loader2, Copy, LayoutTemplate, ChevronDown, Undo2, Package,
} from "lucide-react";
import {
  BLOCK_LIBRARY, STYLE_PRESETS, defaultProps, getBlockDefinition,
  getPreset, tokensToCssVars, type BlockField,
} from "../../lib/departmentSiteSchema";
import {
  useDepartmentSite, useSalvarDepartmentSite, usePublicarDepartmentSite,
  useDadosPreview, type BlocoEditavel,
} from "../../hooks/useDepartmentSite";
import { BlocoRenderer, ancoraDoBloco } from "../../components/public/dept/DeptSiteRenderer";
import CMSDeptPreview, { comoBlocosPublicos } from "./CMSDeptPreview";

/**
 * Construtor visual das páginas de departamento.
 *
 * Três colunas: biblioteca de blocos à esquerda, página no centro (arrastável)
 * e editor do bloco selecionado à direita. O estilo vem de um preset pronto —
 * o departamento escolhe um dos oito e só ajusta o que quiser.
 *
 * O rascunho fica em estado local até "Salvar"; "Publicar" congela o rascunho
 * como versão pública.
 */
export default function CMSDeptBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useDepartmentSite(id);
  const salvar = useSalvarDepartmentSite(id);
  const publicar = usePublicarDepartmentSite(id);

  const [blocos, setBlocos] = useState<BlocoEditavel[]>([]);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [preset, setPreset] = useState("midnight");
  const [abaEstilo, setAbaEstilo] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** 'visual' mostra a página montada; 'estrutura' mostra a lista arrastável. */
  const [modoCentro, setModoCentro] = useState<"visual" | "estrutura">("visual");
  const [preview, setPreview] = useState(false);
  /** Onde o próximo bloco entra, marcado pelo "+" clicado entre dois blocos. */
  const [posicaoInsercao, setPosicaoInsercao] = useState<number | null>(null);

  // Eventos e produtos reais, para o preview não mostrar seção vazia onde a
  // página publicada vai ter conteúdo.
  const { data: dadosPreview } = useDadosPreview(id);
  const eventos = dadosPreview?.eventos ?? { abertos: [], historico: [] };
  const produtos = dadosPreview?.produtos ?? [];

  // Carrega o rascunho vindo do servidor uma vez por site.
  useEffect(() => {
    if (!data) return;
    setBlocos(data.blocks.map((b) => ({
      id: b.id, tipo: b.tipo, variante: b.variante,
      props: b.props ?? {}, visivel: b.visivel,
    })));
    setPreset(data.site.preset ?? "midnight");
    setSujo(false);
  }, [data]);

  const tokens = useMemo(() => getPreset(preset).tokens, [preset]);
  const cssVars = useMemo(() => tokensToCssVars(tokens), [tokens]);

  function alterar(fn: (b: BlocoEditavel[]) => BlocoEditavel[]) {
    setBlocos((atual) => fn(atual));
    setSujo(true);
  }

  /**
   * Insere um bloco. Sem posição, vai para o fim; com posição, entra no ponto
   * marcado pelo "+" que o usuário clicou entre dois blocos.
   */
  function adicionar(tipo: string) {
    const def = getBlockDefinition(tipo);
    if (!def) return;

    const novo: BlocoEditavel = {
      tipo,
      variante: def.variantes[0]?.id ?? "default",
      props: defaultProps(tipo),
      visivel: true,
    };
    const onde = posicaoInsercao ?? blocos.length;

    alterar((b) => [...b.slice(0, onde), novo, ...b.slice(onde)]);
    setSelecionado(onde);
    setPosicaoInsercao(null);
  }

  function atualizarBloco(indice: number, patch: Partial<BlocoEditavel>) {
    alterar((b) => b.map((bl, i) => (i === indice ? { ...bl, ...patch } : bl)));
  }

  function atualizarProp(indice: number, chave: string, valor: unknown) {
    alterar((b) => b.map((bl, i) =>
      i === indice ? { ...bl, props: { ...bl.props, [chave]: valor } } : bl));
  }

  /** Reordena um bloco no modo visual, onde não há alça de arrastar. */
  function moverBloco(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= blocos.length) return;
    alterar((b) => {
      const novo = [...b];
      [novo[indice], novo[destino]] = [novo[destino], novo[indice]];
      return novo;
    });
    setSelecionado(destino);
  }

  async function aoSalvar() {
    setAviso(null);
    try {
      await salvar.mutateAsync({ preset, blocks: blocos } as never);
      setSujo(false);
      setAviso("Rascunho salvo.");
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  async function aoPublicar() {
    setAviso(null);
    try {
      if (sujo) await salvar.mutateAsync({ preset, blocks: blocos } as never);
      const r = await publicar.mutateAsync(true);
      setSujo(false);
      setAviso(r.url ? `Publicado! A página está no ar em ${r.url}` : "Publicado!");
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  if (isLoading) {
    return <div className="flex h-96 items-center justify-center text-slate-500">
      <Loader2 className="animate-spin" /> <span className="ml-2">Carregando…</span>
    </div>;
  }
  if (error || !data) {
    return <div className="p-8 text-center text-red-600">
      {(error as Error)?.message ?? "Página não encontrada."}
    </div>;
  }

  const site = data.site;
  const publicado = site.status === "PUBLICADO";
  const blocoAtual = selecionado != null ? blocos[selecionado] : null;
  const defAtual = blocoAtual ? getBlockDefinition(blocoAtual.tipo) : null;

  // Destinos possíveis para os links do menu. Só blocos já salvos entram: a
  // âncora usa o id do banco, que um bloco novo ainda não tem.
  const secoesDaPagina = blocos
    .filter((b) => b.id)
    .map((b, i) => ({
      id: ancoraDoBloco(b.id!),
      rotulo: `${i + 1}. ${getBlockDefinition(b.tipo)?.label ?? b.tipo}` +
              (typeof b.props.titulo === "string" && b.props.titulo ? ` — ${b.props.titulo}` : ""),
    }));

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-slate-50">
      {/* ── Barra superior ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app-ui/cms")} className="text-slate-400 hover:text-slate-700" aria-label="Voltar">
            <Undo2 size={18} />
          </button>
          <div>
            <h1 className="font-semibold text-slate-900">{site.titulo}</h1>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${publicado ? "bg-emerald-500" : "bg-amber-500"}`} />
              {publicado ? "No ar" : "Rascunho"} · /{site.slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/app-ui/cms/sites/${id}/produtos`)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Package size={15} /> Produtos
          </button>
          {publicado && (
            <a
              href={`/${site.slug}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <ExternalLink size={15} /> Ver página
            </a>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/${site.slug}`);
              setAviso("Link copiado.");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Copy size={15} /> Copiar link
          </button>
          <button
            onClick={aoSalvar} disabled={salvar.isPending || !sujo}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
          >
            {salvar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar
          </button>
          <button
            onClick={() => setPreview(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Eye size={15} /> Pré-visualizar
          </button>
          <button
            onClick={aoPublicar} disabled={publicar.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {publicar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
            {publicado ? "Republicar" : "Publicar"}
          </button>
        </div>
      </header>

      {aviso && (
        <div className="flex items-center justify-between bg-slate-900 px-5 py-2 text-sm text-white">
          {aviso}
          <button onClick={() => setAviso(null)} aria-label="Fechar aviso"><X size={15} /></button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ── Biblioteca ─────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <button
            onClick={() => setAbaEstilo((v) => !v)}
            className="mb-4 flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700"
          >
            <span className="flex items-center gap-2"><Palette size={16} /> Estilo da página</span>
            <ChevronDown size={15} className={abaEstilo ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>

          <AnimatePresence initial={false}>
            {abaEstilo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mb-5 overflow-hidden"
              >
                <div className="flex flex-col gap-2">
                  {STYLE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPreset(p.id); setSujo(true); }}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                        preset === p.id ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex gap-1">
                        {[p.tokens.bg, p.tokens.primary, p.tokens.accent].map((c) => (
                          <span key={c} className="h-6 w-3 rounded-sm" style={{ background: c, border: "1px solid rgba(0,0,0,.1)" }} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{p.nome}</span>
                        <span className="block truncate text-[11px] text-slate-500">{p.descricao}</span>
                      </span>
                      {preset === p.id && <Check size={15} className="shrink-0 text-purple-600" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Blocos</p>
          {Object.entries(
            BLOCK_LIBRARY.reduce<Record<string, typeof BLOCK_LIBRARY>>((acc, b) => {
              (acc[b.grupo] ??= []).push(b);
              return acc;
            }, {}),
          ).map(([grupo, itens]) => (
            <div key={grupo} className="mb-4">
              <p className="mb-1.5 text-[11px] font-medium text-slate-400">{grupo}</p>
              <div className="flex flex-col gap-1">
                {itens.map((b) => (
                  <button
                    key={b.tipo} onClick={() => adicionar(b.tipo)}
                    title={b.descricao}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Plus size={14} className="shrink-0 text-slate-400" />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* ── Página (visual ou estrutura) ───────────────────────────── */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {([["visual", "Visual"], ["estrutura", "Estrutura"]] as const).map(([v, l]) => (
                <button
                  key={v} onClick={() => setModoCentro(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    modoCentro === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {modoCentro === "visual"
                ? "Clique num bloco para editar"
                : "Arraste para reordenar"}
            </p>
          </div>

          {blocos.length === 0 ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
              <LayoutTemplate size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">Escolha um bloco à esquerda para começar sua página.</p>
            </div>
          ) : modoCentro === "visual" ? (
            /* Renderiza com o MESMO componente do portal público, então o que
               aparece aqui é o que o visitante vai ver. */
            <div
              style={cssVars as React.CSSProperties}
              data-tema={getPreset(preset).tema}
              className="mx-auto my-4 max-w-4xl overflow-hidden rounded-xl border border-slate-200 shadow-sm"
            >
              {comoBlocosPublicos(blocos).map((bloco, i) => (
                <div key={bloco.id}>
                <PontoDeInsercao
                  ativo={posicaoInsercao === i}
                  onClick={() => setPosicaoInsercao(posicaoInsercao === i ? null : i)}
                />
                <div
                  onClick={() => setSelecionado(i)}
                  className="group relative cursor-pointer"
                  style={{
                    outline: selecionado === i ? "3px solid #8b5cf6" : undefined,
                    outlineOffset: -3,
                    opacity: blocos[i].visivel ? 1 : 0.35,
                  }}
                >
                  {/* A página renderizada não deve responder a cliques aqui:
                      dentro do builder, tocar num bloco é selecioná-lo. */}
                  <div className="pointer-events-none">
                    <BlocoRenderer
                      bloco={bloco}
                      props={bloco.props}
                      site={{ ...site, preset }}
                      eventos={eventos}
                      produtos={produtos}
                      slug={site.slug}
                    />
                  </div>

                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <BotaoFlutuante
                      titulo="Mover para cima" desabilitado={i === 0}
                      onClick={() => moverBloco(i, -1)}
                    >↑</BotaoFlutuante>
                    <BotaoFlutuante
                      titulo="Mover para baixo" desabilitado={i === blocos.length - 1}
                      onClick={() => moverBloco(i, 1)}
                    >↓</BotaoFlutuante>
                    <BotaoFlutuante
                      titulo={blocos[i].visivel ? "Ocultar" : "Mostrar"}
                      onClick={() => atualizarBloco(i, { visivel: !blocos[i].visivel })}
                    >
                      {blocos[i].visivel ? <Eye size={13} /> : <EyeOff size={13} />}
                    </BotaoFlutuante>
                    <BotaoFlutuante
                      titulo="Remover"
                      onClick={() => {
                        alterar((b) => b.filter((_, idx) => idx !== i));
                        setSelecionado(null);
                      }}
                    >
                      <Trash2 size={13} />
                    </BotaoFlutuante>
                  </div>

                  <span
                    className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {getBlockDefinition(bloco.tipo)?.label ?? bloco.tipo}
                  </span>
                </div>
                </div>
              ))}
              <PontoDeInsercao
                ativo={posicaoInsercao === blocos.length}
                onClick={() => setPosicaoInsercao(
                  posicaoInsercao === blocos.length ? null : blocos.length,
                )}
              />
            </div>
          ) : (
            <Reorder.Group
              axis="y" values={blocos}
              onReorder={(novos) => { setBlocos(novos); setSujo(true); }}
              className="mx-auto flex max-w-3xl flex-col gap-3 p-6"
            >
              {blocos.map((bloco, i) => {
                const def = getBlockDefinition(bloco.tipo);
                const variante = def?.variantes.find((v) => v.id === bloco.variante);
                return (
                  <Reorder.Item
                    key={bloco.id ?? `${bloco.tipo}-${i}`} value={bloco}
                    className={`group flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${
                      selecionado === i ? "border-purple-500 ring-2 ring-purple-100" : "border-slate-200"
                    } ${bloco.visivel ? "" : "opacity-50"}`}
                  >
                    <GripVertical size={16} className="shrink-0 cursor-grab text-slate-300" />
                    <button onClick={() => setSelecionado(i)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-slate-800">{def?.label ?? bloco.tipo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {variante?.label ?? bloco.variante}
                        {typeof bloco.props.titulo === "string" && bloco.props.titulo
                          ? ` · ${bloco.props.titulo}` : ""}
                      </p>
                    </button>
                    <button
                      onClick={() => atualizarBloco(i, { visivel: !bloco.visivel })}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={bloco.visivel ? "Ocultar bloco" : "Mostrar bloco"}
                    >
                      {bloco.visivel ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => {
                        alterar((b) => b.filter((_, idx) => idx !== i));
                        setSelecionado(null);
                      }}
                      className="text-slate-300 hover:text-red-500"
                      aria-label="Remover bloco"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </main>

        {/* ── Editor do bloco ────────────────────────────────────────── */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          {!blocoAtual || !defAtual ? (
            <p className="mt-8 text-center text-sm text-slate-400">
              Selecione um bloco para editar seu conteúdo.
            </p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{defAtual.label}</h2>
                <button onClick={() => setSelecionado(null)} aria-label="Fechar editor">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
              <p className="mb-4 text-xs text-slate-500">{defAtual.descricao}</p>

              <label className="mb-1.5 block text-xs font-medium text-slate-600">Layout</label>
              <div className="mb-5 flex flex-col gap-1.5">
                {defAtual.variantes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => atualizarBloco(selecionado!, { variante: v.id })}
                    className={`rounded-lg border p-2.5 text-left text-sm transition-colors ${
                      blocoAtual.variante === v.id
                        ? "border-purple-500 bg-purple-50 text-purple-900"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block font-medium">{v.label}</span>
                    <span className="block text-[11px] text-slate-500">{v.descricao}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                {defAtual.campos.map((campo) => (
                  <CampoEditor
                    key={campo.key} campo={campo}
                    valor={blocoAtual.props[campo.key]}
                    onChange={(v) => atualizarProp(selecionado!, campo.key, v)}
                    secoes={secoesDaPagina}
                  />
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {preview && (
        <CMSDeptPreview
          site={{ ...site, preset }}
          blocos={blocos}
          preset={preset}
          eventos={eventos}
          produtos={produtos}
          publicando={publicar.isPending || salvar.isPending}
          onFechar={() => setPreview(false)}
          onPublicar={async () => { await aoPublicar(); setPreview(false); }}
        />
      )}
    </div>
  );
}

/**
 * Faixa clicável entre dois blocos.
 *
 * Marca onde o próximo bloco escolhido na biblioteca vai entrar — sem isso
 * todo bloco novo cai no fim da página e o usuário tem que arrastar até o
 * lugar certo.
 */
function PontoDeInsercao({ ativo, onClick }: { ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="group/ins flex w-full items-center gap-2 px-4 py-1 transition-all"
      style={{ height: ativo ? 40 : 14 }}
      title="Inserir bloco aqui"
    >
      <span
        className="h-0.5 flex-1 rounded transition-colors"
        style={{ background: ativo ? "#8b5cf6" : "transparent" }}
      />
      <span
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity ${
          ativo ? "opacity-100" : "opacity-0 group-hover/ins:opacity-100"
        }`}
        style={{ background: ativo ? "#8b5cf6" : "#cbd5e1", color: "#fff" }}
      >
        <Plus size={10} /> {ativo ? "escolha um bloco à esquerda" : "inserir aqui"}
      </span>
      <span
        className="h-0.5 flex-1 rounded transition-colors"
        style={{ background: ativo ? "#8b5cf6" : "transparent" }}
      />
    </button>
  );
}

/** Botão pequeno que flutua sobre o bloco na pré-visualização. */
function BotaoFlutuante({
  titulo, onClick, desabilitado, children,
}: {
  titulo: string; onClick: () => void; desabilitado?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      title={titulo}
      aria-label={titulo}
      disabled={desabilitado}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/85 text-xs text-white backdrop-blur transition-colors hover:bg-slate-900 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ── Editor de um campo ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-400";

function CampoEditor({
  campo, valor, onChange, secoes = [],
}: {
  campo: BlockField; valor: unknown; onChange: (v: unknown) => void;
  /** Seções da página, para o campo "ancora" do menu. */
  secoes?: { id: string; rotulo: string }[];
}) {
  const rotulo = (
    <label className="mb-1 block text-xs font-medium text-slate-600">
      {campo.label}
      {campo.hint && <span className="ml-1 font-normal text-slate-400">— {campo.hint}</span>}
    </label>
  );

  switch (campo.type) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={Boolean(valor)} onChange={(e) => onChange(e.target.checked)} />
          {campo.label}
        </label>
      );

    case "number":
      return (
        <div>{rotulo}
          <input type="number" className={inputCls} value={Number(valor ?? 0)}
                 onChange={(e) => onChange(Number(e.target.value))} />
        </div>
      );

    case "select":
      return (
        <div>{rotulo}
          <select className={inputCls} value={String(valor ?? "")} onChange={(e) => onChange(e.target.value)}>
            {(campo.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );

    case "textarea":
    case "richtext":
      return (
        <div>{rotulo}
          <textarea className={inputCls} rows={campo.type === "richtext" ? 6 : 3}
                    value={String(valor ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "ancora":
      return (
        <div>{rotulo}
          <select className={inputCls} value={String(valor ?? "")}
                  onChange={(e) => onChange(e.target.value)}>
            <option value="">— nenhuma —</option>
            {secoes.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
          </select>
          {secoes.length === 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Salve a página para que as seções fiquem disponíveis aqui.
            </p>
          )}
        </div>
      );

    case "list":
      return <ListaEditor campo={campo} valor={valor} onChange={onChange} secoes={secoes} />;

    default:
      return (
        <div>{rotulo}
          <input className={inputCls} value={String(valor ?? "")}
                 placeholder={campo.type === "image" || campo.type === "video" ? "URL do arquivo" : undefined}
                 onChange={(e) => onChange(e.target.value)} />
          {campo.type === "image" && typeof valor === "string" && valor && (
            <img src={valor} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" />
          )}
        </div>
      );
  }
}

function ListaEditor({
  campo, valor, onChange, secoes = [],
}: {
  campo: BlockField; valor: unknown; onChange: (v: unknown) => void;
  secoes?: { id: string; rotulo: string }[];
}) {
  const itens = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];

  function alterarItem(i: number, chave: string, v: unknown) {
    onChange(itens.map((it, idx) => (idx === i ? { ...it, [chave]: v } : it)));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">{campo.label}</label>
        <button
          onClick={() => onChange([...itens, {}])}
          className="flex items-center gap-1 text-xs text-purple-600 hover:underline"
        >
          <Plus size={12} /> Adicionar
        </button>
      </div>
      {campo.hint && <p className="mb-2 text-[11px] text-slate-400">{campo.hint}</p>}

      <div className="flex flex-col gap-3">
        {itens.map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">#{i + 1}</span>
              <button
                onClick={() => onChange(itens.filter((_, idx) => idx !== i))}
                className="text-slate-300 hover:text-red-500" aria-label="Remover item"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {(campo.itemFields ?? []).map((sub) => (
                <CampoEditor
                  key={sub.key} campo={sub} valor={item[sub.key]}
                  onChange={(v) => alterarItem(i, sub.key, v)}
                  secoes={secoes}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
