import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Globe, Edit3, CheckCircle, AlertCircle, PlusCircle,
  Layers, Loader2, ExternalLink, Copy, X,
} from "lucide-react";
import {
  useDepartmentSites, useCriarDepartmentSite, useMinisteriosSemSite,
} from "../../hooks/useDepartmentSite";
import { STYLE_PRESETS, getPreset } from "../../lib/departmentSiteSchema";

/**
 * Painel do CMS: uma página por departamento (ministério) do campo.
 *
 * Os dados vêm de `department_sites` — antes esta tela mostrava uma lista fixa
 * com status de publicação simulado, o que não refletia nada do banco.
 */
export default function CMSDashboard() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<"todos" | "publicados" | "rascunhos">("todos");
  const [criando, setCriando] = useState(false);

  const { data: sites, isLoading, error } = useDepartmentSites();

  const lista = useMemo(() => {
    const base = sites ?? [];
    if (filtro === "publicados") return base.filter((s) => s.status === "PUBLICADO");
    if (filtro === "rascunhos") return base.filter((s) => s.status !== "PUBLICADO");
    return base;
  }, [sites, filtro]);

  const publicados = (sites ?? []).filter((s) => s.status === "PUBLICADO").length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CMS de Departamentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cada departamento tem sua própria página, com endereço para compartilhar.
          </p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          <PlusCircle size={15} /> Nova página
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Estatistica icone={Layers} rotulo="Páginas" valor={sites?.length ?? 0} />
        <Estatistica icone={CheckCircle} rotulo="No ar" valor={publicados} cor="text-emerald-500" />
        <Estatistica icone={AlertCircle} rotulo="Rascunhos" valor={(sites?.length ?? 0) - publicados} cor="text-amber-500" />
      </div>

      <div className="mb-5 flex gap-2">
        {([["todos", "Todas"], ["publicados", "No ar"], ["rascunhos", "Rascunhos"]] as const).map(([v, l]) => (
          <button
            key={v} onClick={() => setFiltro(v)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              filtro === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{(error as Error).message}</p>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Globe size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">
            Nenhuma página ainda. Crie a primeira para um dos seus departamentos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lista.map((site, i) => {
            const preset = getPreset(site.preset);
            const noAr = site.status === "PUBLICADO";
            return (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="h-20" style={{ background: preset.tokens.heroOverlay }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900">{site.titulo}</h3>
                      <p className="truncate text-xs text-slate-500">/{site.slug} · {preset.nome}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        noAr ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {noAr ? "No ar" : "Rascunho"}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => navigate(`/app-ui/cms/sites/${site.id}/builder`)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                    {noAr && (
                      <>
                        <a
                          href={`/${site.slug}`} target="_blank" rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                          aria-label="Abrir página"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${site.slug}`)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                          aria-label="Copiar link"
                        >
                          <Copy size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {criando && <ModalNovaPagina onFechar={() => setCriando(false)} />}
    </div>
  );
}

function Estatistica({
  icone: Icone, rotulo, valor, cor = "text-slate-400",
}: { icone: React.ElementType; rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Icone size={18} className={cor} />
      <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500">{rotulo}</p>
    </div>
  );
}

function ModalNovaPagina({ onFechar }: { onFechar: () => void }) {
  const navigate = useNavigate();
  const { data: ministerios, isLoading } = useMinisteriosSemSite();
  const { data: sites } = useDepartmentSites();
  const criar = useCriarDepartmentSite();

  const [departmentId, setDepartmentId] = useState("");
  const [preset, setPreset] = useState("midnight");
  const [erro, setErro] = useState<string | null>(null);

  // Um ministério só pode ter uma página.
  const jaTemSite = new Set((sites ?? []).map((s) => s.department_id));
  const disponiveis = (ministerios ?? []).filter((m) => !jaTemSite.has(m.id));

  async function confirmar() {
    setErro(null);
    try {
      const r = await criar.mutateAsync({ departmentId, preset });
      onFechar();
      navigate(`/app-ui/cms/sites/${r.site.id}/builder`);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Nova página de departamento</h2>
          <button onClick={onFechar} aria-label="Fechar"><X size={18} className="text-slate-400" /></button>
        </div>

        {isLoading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : disponiveis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todos os departamentos do seu campo já têm página. Cadastre um novo ministério para criar outra.
          </p>
        ) : (
          <>
            <label className="mb-1 block text-xs font-medium text-slate-600">Departamento</label>
            <select
              value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Escolha…</option>
              {disponiveis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <label className="mb-1 block text-xs font-medium text-slate-600">Estilo</label>
            <div className="mb-4 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id} onClick={() => setPreset(p.id)}
                  className={`rounded-lg border p-2 text-left transition-colors ${
                    preset === p.id ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="mb-1.5 flex h-8 overflow-hidden rounded" style={{ background: p.tokens.heroOverlay }} />
                  <span className="block text-xs font-medium text-slate-800">{p.nome}</span>
                </button>
              ))}
            </div>

            {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}

            <button
              onClick={confirmar} disabled={!departmentId || criar.isPending}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {criar.isPending ? "Criando…" : "Criar e abrir o editor"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
