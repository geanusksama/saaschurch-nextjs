import { ArrowRightLeft, ArrowUpRight, Droplets, FolderOpen, Shirt, TrendingUp } from "lucide-react";

/**
 * Grade de pastas de trabalho do Pipeline da Secretaria (guia Silas CRM).
 *
 * Só apresentação: cada pasta é um tipo de atividade (stage) que a tela já
 * carregava. Clicar chama `onAbrir(stage.id)`, que faz o mesmo `setStageId` que
 * as antigas abas do topo faziam. O resumo (totais por etapa) vem da mesma
 * rota do quadro, carregada pela tela-mãe com os filtros dela.
 */

export type ResumoPasta = {
  total: number;
  etapas: Array<{ id: number; nome: string; total: number }>;
};

// Etapas que contam como "pendência": tudo que não é finalizado/cancelado.
function ehEncerrada(nome: string) {
  const n = nome.toLowerCase();
  return n.includes("finaliz") || n.includes("conclu") || n.includes("cancel") || n.includes("arquiv") || n.includes("aprovad") || n.includes("reprovad") || n.includes("indefer") || n.includes("deferid");
}

function dataCurta(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

type PastaStage = {
  id: number;
  name: string;
  description: string | null;
  service?: { sigla?: string | null; description?: string | null } | null;
  columns: Array<{ id: number; name: string }>;
};

// Cards chapados, alternando como no guia: escuro, primária, branco, lilás.
const VARIANTES = [
  { card: "bg-[var(--sl-dark)] text-white", ear: "bg-[var(--sl-dark)]", sheet: "bg-[color-mix(in_srgb,var(--sl-dark)_35%,white)]", sub: "text-white/70", tile: "bg-white/10 text-white", chip: "bg-white/15 text-white", border: "border-transparent" },
  { card: "bg-[var(--sl-primary)] text-white", ear: "bg-[var(--sl-primary)]", sheet: "bg-[color-mix(in_srgb,var(--sl-primary)_40%,white)]", sub: "text-white/75", tile: "bg-white/15 text-white", chip: "bg-white/20 text-white", border: "border-transparent" },
  { card: "bg-[var(--sl-solid)] text-[var(--sl-text)]", ear: "bg-[var(--sl-solid)]", sheet: "bg-[color-mix(in_srgb,var(--sl-primary)_22%,white)]", sub: "text-[var(--sl-text-3)]", tile: "bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]", chip: "bg-[var(--sl-chip)] text-[var(--sl-text-2)]", border: "border-[var(--sl-border)]" },
  { card: "bg-[color-mix(in_srgb,var(--sl-primary)_16%,var(--sl-solid))] text-[var(--sl-text)]", ear: "bg-[color-mix(in_srgb,var(--sl-primary)_16%,var(--sl-solid))]", sheet: "bg-[color-mix(in_srgb,var(--sl-primary)_32%,white)]", sub: "text-[var(--sl-text-3)]", tile: "bg-[var(--sl-solid)] text-[var(--sl-primary)]", chip: "bg-[var(--sl-solid)] text-[var(--sl-text-2)]", border: "border-transparent" },
];

function iconeDaPasta(stage: PastaStage) {
  const haystack = [stage.name, stage.description || "", stage.service?.sigla || "", stage.service?.description || ""].join(" ").toLowerCase();
  if (haystack.includes("batis")) return Droplets;
  if (haystack.includes("consagra")) return Shirt;
  if (haystack.includes("transf")) return ArrowRightLeft;
  return TrendingUp;
}

export function PipelinePastas({
  stages,
  stageAtual,
  resumo,
  periodo,
  onAbrir,
}: {
  stages: PastaStage[];
  stageAtual: number | null;
  resumo: Record<number, ResumoPasta>;
  periodo: { from: string; to: string };
  onAbrir: (stageId: number) => void;
}) {
  return (
    <div className="p-4 sm:px-6 sm:pt-4 sm:pb-6">
      {/* Cabeçalho */}
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
          <FolderOpen className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-[var(--sl-text-3)]">Secretaria · Pipeline</p>
          <h1 className="text-[22px] font-bold leading-tight text-[var(--sl-text)]">Pastas de trabalho</h1>
        </div>
        <span className="ml-auto whitespace-nowrap text-[13px] text-[var(--sl-text-3)]">
          {stages.length > 0 ? `Período ${dataCurta(periodo.from)} – ${dataCurta(periodo.to)}` : ""}
        </span>
      </div>

      {stages.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-[var(--sl-border-2)] bg-[var(--sl-surface)] px-6 py-12 text-center text-sm text-[var(--sl-text-3)]">
          Carregando pastas…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {stages.map((stage, i) => {
            const v = VARIANTES[i % VARIANTES.length];
            const Icone = iconeDaPasta(stage);
            const r = resumo[stage.id];
            const etapas = r ? r.etapas : (stage.columns || []).map((c) => ({ id: c.id, nome: c.name, total: 0 }));
            const pendentes = r ? r.etapas.filter((e) => !ehEncerrada(e.nome)).reduce((s, e) => s + e.total, 0) : 0;
            const visiveis = etapas.slice(0, 3);
            const resto = etapas.length - visiveis.length;
            const ativa = stageAtual === stage.id;
            const detalhe = stage.description || stage.service?.description || "";

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onAbrir(stage.id)}
                title={stage.description || stage.name}
                className="group relative block cursor-pointer text-left transition-transform duration-150 hover:-translate-y-0.5"
              >
                {/* folhas atrás da pasta */}
                <span className={`absolute -top-3 left-[38%] right-5 h-6 rounded-t-[14px] ${v.sheet} opacity-80`} />
                {/* orelha da pasta */}
                <span className={`absolute -top-2.5 left-0 h-6 w-[44%] rounded-t-[18px] ${v.ear} ${v.border === "border-transparent" ? "" : "border border-b-0 " + v.border}`} />
                {/* corpo */}
                <span
                  className={`relative flex min-h-[200px] flex-col rounded-[22px] rounded-tl-none border p-5 ${v.card} ${v.border} ${
                    ativa ? "ring-2 ring-[var(--sl-primary)] ring-offset-2 ring-offset-transparent" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${v.tile}`}>
                      <Icone className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[18px] font-bold leading-tight">{stage.name}</span>
                  </span>

                  {detalhe ? <span className={`mt-3 line-clamp-1 block text-[13px] ${v.sub}`}>{detalhe}</span> : null}

                  {/* Resumo: total no período e pendências */}
                  <span className="mt-4 flex items-end gap-4">
                    <span className="flex flex-col">
                      <span className="text-[26px] font-extrabold leading-none tracking-tight">{r ? r.total : "–"}</span>
                      <span className={`mt-1 text-[12px] font-medium ${v.sub}`}>{r && r.total === 1 ? "processo" : "processos"}</span>
                    </span>
                    {r && pendentes > 0 ? (
                      <span className="mb-0.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--sl-badge)] px-2.5 py-1 text-[11.5px] font-bold text-white">
                        {pendentes} {pendentes === 1 ? "pendente" : "pendentes"}
                      </span>
                    ) : r ? (
                      <span className={`mb-0.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${v.chip}`}>Sem pendências</span>
                    ) : null}
                  </span>

                  <span className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <span className="flex min-w-0 flex-wrap gap-1.5">
                      {visiveis.map((etapa) => (
                        <span key={etapa.id} className={`max-w-[140px] truncate whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${v.chip}`}>
                          {etapa.nome}{r ? ` · ${etapa.total}` : ""}
                        </span>
                      ))}
                      {resto > 0 ? (
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${v.chip}`}>+{resto}</span>
                      ) : null}
                    </span>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${v.tile}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
