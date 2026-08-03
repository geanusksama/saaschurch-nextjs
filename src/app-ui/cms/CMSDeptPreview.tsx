"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { X, Monitor, Smartphone, ExternalLink, Rocket, Loader2 } from "lucide-react";
import DeptSiteRenderer from "../../components/public/dept/DeptSiteRenderer";
import { getPreset, tokensToCssVars, type DepartmentSite, type SiteBlock } from "../../lib/departmentSiteSchema";
import type { BlocoEditavel } from "../../hooks/useDepartmentSite";

/**
 * Converte os blocos do builder no formato que o renderizador público espera.
 *
 * `props_publicado` recebe as props do rascunho de propósito: o preview mostra
 * o que está sendo editado agora, não a versão que está no ar.
 */
export function comoBlocosPublicos(blocos: BlocoEditavel[]): SiteBlock[] {
  return blocos.map((b, i) => ({
    id: b.id ?? `preview-${i}`,
    site_id: "preview",
    tipo: b.tipo,
    variante: b.variante,
    ordem: i,
    props: b.props,
    props_publicado: b.props,
    visivel: b.visivel,
  }));
}

interface Props {
  site: DepartmentSite;
  blocos: BlocoEditavel[];
  preset: string;
  eventos: { abertos: unknown[]; historico: unknown[] };
  produtos: unknown[];
  onFechar: () => void;
  onPublicar: () => void;
  publicando: boolean;
}

/**
 * Pré-visualização em tela cheia — o "ver antes de lançar".
 *
 * Renderiza a página com o MESMO componente do portal público, então o que
 * aparece aqui é exatamente o que o visitante vai ver. A diferença é só a
 * origem dos blocos: rascunho em vez do snapshot publicado.
 */
export default function CMSDeptPreview({
  site, blocos, preset, eventos, produtos, onFechar, onPublicar, publicando,
}: Props) {
  const [largura, setLargura] = useState<"celular" | "computador">("computador");

  const visiveis = blocos.filter((b) => b.visivel);
  const cssVars = tokensToCssVars(getPreset(preset).tokens, site.tokens_override ?? {});
  const siteParaPreview = { ...site, preset };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "#0f172a" }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onFechar} className="text-slate-400 hover:text-white" aria-label="Fechar pré-visualização">
            <X size={18} />
          </button>
          <div>
            <p className="text-sm font-semibold text-white">Pré-visualização · {site.titulo}</p>
            <p className="text-xs text-slate-400">
              É assim que a página fica ao publicar em /{site.slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 p-0.5">
            <BotaoLargura
              ativo={largura === "computador"} onClick={() => setLargura("computador")}
              icone={<Monitor size={14} />} rotulo="Computador"
            />
            <BotaoLargura
              ativo={largura === "celular"} onClick={() => setLargura("celular")}
              icone={<Smartphone size={14} />} rotulo="Celular"
            />
          </div>

          {site.status === "PUBLICADO" && (
            <a
              href={`/${site.slug}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              <ExternalLink size={14} /> Página no ar
            </a>
          )}
          <button
            onClick={onPublicar} disabled={publicando || visiveis.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {publicando ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            {site.status === "PUBLICADO" ? "Republicar" : "Publicar"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {visiveis.length === 0 ? (
          <p className="mt-20 text-center text-slate-400">
            Nenhum bloco visível. Adicione um bloco para ver a página.
          </p>
        ) : (
          <motion.div
            layout
            className="mx-auto overflow-hidden bg-white shadow-2xl"
            style={{
              width: largura === "celular" ? 390 : "100%",
              maxWidth: largura === "celular" ? 390 : 1280,
              borderRadius: largura === "celular" ? 28 : 12,
            }}
          >
            <div style={cssVars as React.CSSProperties} data-tema={getPreset(preset).tema}>
              <DeptSiteRenderer
                site={siteParaPreview}
                blocks={comoBlocosPublicos(visiveis)}
                departamento={null}
                eventos={eventos}
                produtos={produtos}
                modo="rascunho"
                slug={site.slug}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function BotaoLargura({
  ativo, onClick, icone, rotulo,
}: { ativo: boolean; onClick: () => void; icone: React.ReactNode; rotulo: string }) {
  return (
    <button
      onClick={onClick}
      title={rotulo}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
        ativo ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icone} {rotulo}
    </button>
  );
}
