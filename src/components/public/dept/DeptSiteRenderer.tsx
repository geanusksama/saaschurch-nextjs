"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
// lucide-react nesta versao nao exporta icones de marca (Instagram/YouTube),
// entao AtSign e PlayCircle fazem esse papel.
import {
  Calendar, MapPin, Clock, ChevronDown, ChevronLeft, ChevronRight, AtSign, PlayCircle,
  MessageCircle, Mail, ArrowRight, Quote, ShoppingBag,
} from "lucide-react";
import { blockProps, type DepartmentSite, type SiteBlock } from "@/lib/departmentSiteSchema";
import DeptStore from "./DeptStore";
import DeptEventos from "./DeptEventos";

/**
 * Renderiza uma página de departamento a partir dos blocos salvos no CMS.
 *
 * As cores e fontes chegam por CSS custom properties (`--ds-*`) definidas pelo
 * preset no wrapper da página, então este componente nunca hardcoda cor —
 * trocar de preset muda a página inteira sem tocar em nenhum bloco.
 */

// Atalhos para os tokens do preset.
const T = {
  bg: "var(--ds-bg)",
  surface: "var(--ds-surface)",
  surfaceAlt: "var(--ds-surface-alt)",
  border: "var(--ds-border)",
  text: "var(--ds-text)",
  muted: "var(--ds-text-muted)",
  primary: "var(--ds-primary)",
  secondary: "var(--ds-secondary)",
  accent: "var(--ds-accent)",
  radius: "var(--ds-radius)",
  fontTitle: "var(--ds-font-title)",
  heroOverlay: "var(--ds-hero-overlay)",
  shadow: "var(--ds-shadow)",
};

/** Id da âncora de um bloco, usado pelos links do menu. */
export function ancoraDoBloco(blocoId: string) {
  return `sec-${blocoId}`;
}

type Props = Record<string, unknown>;
const txt = (p: Props, k: string, d = "") => String(p[k] ?? d);
const num = (p: Props, k: string, d = 0) => Number(p[k] ?? d);
const bool = (p: Props, k: string, d = false) => Boolean(p[k] ?? d);
const list = (p: Props, k: string) => (Array.isArray(p[k]) ? (p[k] as Props[]) : []);

export interface DeptEvento {
  id: string;
  nome: string;
  descricao: string | null;
  banner: string | null;
  data_inicio: string | null;
  local: string | null;
  valor: number;
  gratuito: boolean;
  inscricoesAbertas: boolean;
  lotado: boolean;
  encerrado: boolean;
  vagasRestantes: number | null;
  form: Record<string, unknown> | null;
}

export interface DeptProduto {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  descricao_curta: string | null;
  categoria: string | null;
  preco: number;
  preco_promocional: number | null;
  parcelas_max: number;
  ficha_tecnica: Array<{ label: string; value: string }>;
  tabela_medidas: Record<string, unknown> | null;
  destaque: boolean;
  imagens: Array<{ id: string; url: string; alt: string | null; variant_cor: string | null }>;
  variacoes: Array<{
    id: string; cor: string | null; cor_hex: string | null;
    tamanho: string | null; preco: number | null; estoque: number;
  }>;
}

interface RendererProps {
  site: DepartmentSite;
  blocks: SiteBlock[];
  departamento: { id: string; name: string; color: string | null; icon: string | null } | null;
  eventos: { abertos: unknown[]; historico: unknown[] };
  produtos: unknown[];
  modo: "publicado" | "rascunho";
  slug: string;
}

export default function DeptSiteRenderer({
  site, blocks, eventos, produtos, modo, slug,
}: RendererProps) {
  const visiveis = useMemo(
    () => blocks.filter((b) => b.visivel || modo === "rascunho").sort((a, b) => a.ordem - b.ordem),
    [blocks, modo],
  );

  return (
    <div
      style={{ background: T.bg, color: T.text, fontFamily: "var(--ds-font-body), system-ui, sans-serif" }}
      className="min-h-screen w-full overflow-x-hidden"
    >
      {/* A barra padrão só aparece quando a página não tem um bloco de menu —
          senão o visitante veria dois cabeçalhos empilhados. */}
      {!visiveis.some((b) => b.tipo === "menu") && <TopBar site={site} />}

      {visiveis.map((bloco) => (
        // A âncora permite que os itens do menu rolem até a seção.
        <section key={bloco.id} id={ancoraDoBloco(bloco.id)}>
          <BlocoRenderer
            bloco={bloco}
            props={blockProps(bloco, modo)}
            site={site}
            eventos={eventos}
            produtos={produtos}
            slug={slug}
          />
        </section>
      ))}

      <Rodape site={site} />
    </div>
  );
}

// ── Barra do topo ────────────────────────────────────────────────────────────

function TopBar({ site }: { site: DepartmentSite }) {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{ background: `color-mix(in srgb, ${T.bg} 85%, transparent)`, borderBottom: `1px solid ${T.border}` }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          {site.logo_url
            ? <img src={site.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
            : <div className="h-9 w-9 rounded-lg" style={{ background: T.primary }} />}
          <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: T.fontTitle }}>
            {site.titulo}
          </span>
        </div>
        {site.whatsapp_number && (
          <a
            href={`https://wa.me/${site.whatsapp_number.replace(/\D/g, "")}`}
            target="_blank" rel="noreferrer"
            className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
            style={{ background: T.primary, color: "#fff", borderRadius: T.radius }}
          >
            Fale conosco
          </a>
        )}
      </div>
    </header>
  );
}

// ── Distribuidor de blocos ───────────────────────────────────────────────────

export function BlocoRenderer({
  bloco, props, site, eventos, produtos, slug,
}: {
  bloco: SiteBlock; props: Props; site: DepartmentSite;
  eventos: { abertos: unknown[]; historico: unknown[] };
  produtos: unknown[]; slug: string;
}) {
  const v = bloco.variante || "default";

  switch (bloco.tipo) {
    case "menu":        return <MenuTopo p={props} variante={v} site={site} />;
    case "html":        return <HtmlProprio p={props} variante={v} />;
    case "container":   return <Container p={props} variante={v} />;
    case "tabela":      return <Tabela p={props} variante={v} />;
    case "hero":        return <Hero p={props} variante={v} />;
    case "texto":       return <Texto p={props} variante={v} />;
    case "galeria":     return <Galeria p={props} variante={v} />;
    case "video":       return <Video p={props} variante={v} />;
    case "eventos":
      return (
        <DeptEventos
          p={props} variante={v} slug={slug}
          abertos={eventos.abertos as DeptEvento[]}
          historico={eventos.historico as DeptEvento[]}
        />
      );
    case "loja":
      return <DeptStore p={props} variante={v} slug={slug} produtos={produtos as DeptProduto[]} site={site} />;
    case "formulario":  return <Formulario p={props} variante={v} slug={slug} />;
    case "equipe":      return <Equipe p={props} variante={v} />;
    case "depoimentos": return <Depoimentos p={props} variante={v} />;
    case "numeros":     return <Numeros p={props} variante={v} />;
    case "faq":         return <Faq p={props} variante={v} />;
    case "agenda":      return <Agenda p={props} variante={v} />;
    case "cta":         return <Cta p={props} variante={v} />;
    case "mapa":        return <Mapa p={props} variante={v} />;
    case "contato":     return <Contato p={props} variante={v} site={site} />;
    case "espacador":   return <Espacador p={props} variante={v} />;
    default:            return null;
  }
}

// ── Estruturas reutilizadas ──────────────────────────────────────────────────

function Secao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-6xl px-5 py-16 md:py-20 ${className}`}>{children}</section>;
}

function TituloSecao({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <h2 className="mb-8 text-3xl font-bold tracking-tight md:text-4xl" style={{ fontFamily: T.fontTitle }}>
      {children}
    </h2>
  );
}

function Botao({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href || !children) return null;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
      style={{ background: T.primary, color: "#fff", borderRadius: T.radius, boxShadow: T.shadow }}
    >
      {children}
      <ArrowRight size={16} />
    </a>
  );
}

// ── MENU DO TOPO ─────────────────────────────────────────────────────────────

function MenuTopo({ p, variante, site }: { p: Props; variante: string; site: DepartmentSite }) {
  const itens = list(p, "itens");
  const logo = txt(p, "logo") || site.logo_url || "";
  const nome = txt(p, "titulo") || site.titulo;
  const alturaLogo = num(p, "alturaLogo", 36);
  const fixo = bool(p, "fixo", true);
  const transparente = variante === "transparente";

  const link = (item: Props) => {
    const ancora = txt(item, "ancora");
    if (ancora) return `#${ancora}`;
    return txt(item, "url") || "#";
  };

  const marca = logo
    ? <img src={logo} alt={nome} style={{ height: alturaLogo }} className="w-auto object-contain" />
    : <span className="text-lg font-bold tracking-tight" style={{ fontFamily: T.fontTitle }}>{nome}</span>;

  const links = (
    <nav className="flex flex-wrap items-center gap-1">
      {itens.map((item, i) => (
        <a
          key={i}
          href={link(item)}
          className="px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={variante === "pilulas"
            ? { background: T.surfaceAlt, borderRadius: 999, margin: 2 }
            : undefined}
        >
          {txt(item, "label")}
        </a>
      ))}
    </nav>
  );

  const botao = txt(p, "ctaTexto") ? (
    <a
      href={txt(p, "ctaUrl") || "#"}
      className="px-5 py-2 text-sm font-semibold transition-transform hover:scale-[1.03]"
      style={{ background: T.primary, color: "#fff", borderRadius: T.radius }}
    >
      {txt(p, "ctaTexto")}
    </a>
  ) : null;

  const conteudo =
    variante === "centralizado" ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1">{links}</div>
        <div className="shrink-0">{marca}</div>
        <div className="flex flex-1 justify-end">{botao}</div>
      </div>
    ) : variante === "empilhado" ? (
      <div className="flex flex-col items-center gap-3">
        {marca}
        {links}
        {botao}
      </div>
    ) : (
      <div className="flex flex-wrap items-center justify-between gap-3">
        {marca}
        <div className="flex items-center gap-3">
          {links}
          {variante === "cta" && botao}
        </div>
      </div>
    );

  return (
    <header
      className={`${fixo ? "sticky top-0" : ""} z-40 w-full ${transparente ? "" : "backdrop-blur-md"}`}
      style={{
        background: transparente
          ? "transparent"
          : `color-mix(in srgb, ${T.bg} 88%, transparent)`,
        borderBottom: transparente ? "none" : `1px solid ${T.border}`,
        color: T.text,
      }}
    >
      <div className="mx-auto max-w-6xl px-5 py-3">{conteudo}</div>
    </header>
  );
}

// ── HTML PRÓPRIO ─────────────────────────────────────────────────────────────

/**
 * Remove o que não deve rodar numa página pública.
 *
 * O HTML aqui é escrito por administradores do campo, mas fica servido para
 * qualquer visitante: se uma conta de admin for comprometida, um `<script>`
 * salvo neste bloco rodaria no navegador de todo mundo. Iframes continuam
 * permitidos porque são o caso de uso real (mapas, formulários, vídeos).
 */
function limparHtml(bruto: string): string {
  return bruto
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

const ESPACOS: Record<string, string> = { none: "0", sm: "24px", md: "64px", lg: "96px" };

function HtmlProprio({ p, variante }: { p: Props; variante: string }) {
  const html = txt(p, "html");
  const css = txt(p, "css");
  if (!html && !css) return null;

  const espaco = ESPACOS[txt(p, "espacamento", "md")] ?? ESPACOS.md;
  // Escopo do CSS: só vale dentro deste bloco, para não vazar para a página.
  const escopo = `bloco-html-${Math.abs(hashSimples(html + css))}`;

  return (
    <div style={{ paddingTop: espaco, paddingBottom: espaco }}>
      {css && (
        <style dangerouslySetInnerHTML={{
          __html: css.replace(/(^|\})\s*([^@{}]+)\{/g, (_m, fim, seletor) =>
            `${fim} .${escopo} ${seletor.trim()}{`),
        }} />
      )}
      <div
        className={`${escopo} ${variante === "largura-total" ? "w-full" : "mx-auto max-w-6xl px-5"}`}
        dangerouslySetInnerHTML={{ __html: limparHtml(html) }}
      />
    </div>
  );
}

function hashSimples(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}

// ── CONTAINER ────────────────────────────────────────────────────────────────

function Container({ p, variante }: { p: Props; variante: string }) {
  const caixas = list(p, "colunas");
  if (!caixas.length) return null;

  const colunas = variante === "destaque" ? 1 : Number(variante.charAt(0)) || 2;
  const comBorda = bool(p, "borda", true);
  const fundo = txt(p, "fundo");
  const alinhamento = txt(p, "alinhamento", "left");

  return (
    <div style={fundo ? { background: fundo } : undefined}>
      <Secao>
        <TituloSecao>{txt(p, "titulo")}</TituloSecao>
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(1100 / colunas)}px, 1fr))` }}
        >
          {caixas.map((c, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 p-6"
              style={{
                textAlign: alinhamento as "left" | "center" | "right",
                background: T.surface,
                border: comBorda ? `1px solid ${T.border}` : "none",
                borderRadius: T.radius,
              }}
            >
              {txt(c, "imagem") && (
                <img src={txt(c, "imagem")} alt="" className="h-40 w-full object-cover"
                     style={{ borderRadius: T.radius }} />
              )}
              {txt(c, "icone") && <span className="text-3xl">{txt(c, "icone")}</span>}
              {txt(c, "titulo") && (
                <h3 className="text-lg font-semibold" style={{ fontFamily: T.fontTitle }}>
                  {txt(c, "titulo")}
                </h3>
              )}
              {txt(c, "texto") && (
                <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: T.muted }}>
                  {txt(c, "texto")}
                </p>
              )}
              {txt(c, "botaoTexto") && (
                <div className="mt-auto pt-2">
                  <Botao href={txt(c, "botaoUrl")}>{txt(c, "botaoTexto")}</Botao>
                </div>
              )}
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}

// ── TABELA ───────────────────────────────────────────────────────────────────

function Tabela({ p, variante }: { p: Props; variante: string }) {
  const cabecalho = list(p, "colunas").map((c) => txt(c, "titulo"));
  const linhas = list(p, "linhas");
  if (!linhas.length) return null;

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      {/* Tabela larga rola sozinha, sem empurrar a página para o lado. */}
      <div
        className="overflow-x-auto"
        style={variante === "cartao"
          ? { border: `1px solid ${T.border}`, borderRadius: T.radius }
          : undefined}
      >
        <table className="w-full border-collapse text-sm">
          {cabecalho.length > 0 && (
            <thead>
              <tr>
                {cabecalho.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left font-semibold"
                    style={{ borderBottom: `2px solid ${T.border}`, color: T.text }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {linhas.map((linha, i) => {
              const celulas = txt(linha, "celulas").split("|").map((c) => c.trim());
              const destaque = bool(linha, "destaque");
              return (
                <tr
                  key={i}
                  style={{
                    background: destaque
                      ? `color-mix(in srgb, ${T.primary} 12%, transparent)`
                      : variante === "listrada" && i % 2 === 1 ? T.surfaceAlt : undefined,
                  }}
                >
                  {celulas.map((c, j) => (
                    <td
                      key={j}
                      className="px-4 py-3"
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        color: j === 0 ? T.text : T.muted,
                        fontWeight: destaque || j === 0 ? 600 : 400,
                      }}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────

const ALTURAS: Record<string, string> = {
  sm: "40vh", md: "55vh", lg: "72vh", full: "100vh",
};

/** Como um slide entra e sai, por efeito escolhido no CMS. */
const EFEITOS_SLIDE: Record<string, {
  initial: Record<string, number>; animate: Record<string, number>;
  exit: Record<string, number>; duracao: number;
}> = {
  fade:      { initial: { opacity: 0 },            animate: { opacity: 1 },          exit: { opacity: 0 },             duracao: 0.8 },
  deslizar:  { initial: { opacity: 0, x: 80 },     animate: { opacity: 1, x: 0 },    exit: { opacity: 0, x: -80 },     duracao: 0.7 },
  zoom:      { initial: { opacity: 0, scale: 1.15 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, duracao: 0.9 },
  empurrar:  { initial: { opacity: 0, y: 60 },     animate: { opacity: 1, y: 0 },    exit: { opacity: 0, y: -60 },     duracao: 0.7 },
  cortina:   { initial: { opacity: 0, scaleY: 0 }, animate: { opacity: 1, scaleY: 1 }, exit: { opacity: 0, scaleY: 0 }, duracao: 0.6 },
};

function Hero({ p, variante }: { p: Props; variante: string }) {
  const slides = list(p, "slides");
  const [ativo, setAtivo] = useState(0);

  const ehCarrossel = variante === "carousel" && slides.length > 0;
  const autoplay = bool(p, "autoplay", true);
  const intervalo = Math.max(2, num(p, "intervalo", 6)) * 1000;
  const efeito = EFEITOS_SLIDE[txt(p, "efeito", "fade")] ?? EFEITOS_SLIDE.fade;

  // Passa sozinho. Reinicia a contagem quando o slide muda na mão, para não
  // trocar logo depois de o visitante clicar numa seta.
  useEffect(() => {
    if (!ehCarrossel || !autoplay || slides.length < 2) return;
    const t = setTimeout(() => setAtivo((i) => (i + 1) % slides.length), intervalo);
    return () => clearTimeout(t);
  }, [ehCarrossel, autoplay, intervalo, ativo, slides.length]);

  const altura = ALTURAS[txt(p, "altura", "lg")] ?? ALTURAS.lg;
  const alinhamento = txt(p, "alinhamento", "center");
  const overlay = num(p, "overlay", 50) / 100;

  const indice = ehCarrossel ? ativo % slides.length : 0;
  const slideAtual = ehCarrossel
    ? {
        imagem: txt(slides[indice], "imagem"),
        titulo: txt(slides[indice], "titulo") || txt(p, "titulo"),
        subtitulo: txt(slides[indice], "subtitulo") || txt(p, "subtitulo"),
        ctaTexto: txt(slides[indice], "ctaTexto") || txt(p, "ctaTexto"),
        ctaUrl: txt(slides[indice], "ctaUrl") || txt(p, "ctaUrl"),
      }
    : {
        imagem: txt(p, "imagem"), titulo: txt(p, "titulo"), subtitulo: txt(p, "subtitulo"),
        ctaTexto: txt(p, "ctaTexto"), ctaUrl: txt(p, "ctaUrl"),
      };

  const alinha =
    alinhamento === "left" ? "items-start text-left"
    : alinhamento === "right" ? "items-end text-right"
    : "items-center text-center";

  // Variante dividida: texto e imagem lado a lado, sem overlay.
  if (variante === "split") {
    return (
      <section className="grid gap-0 md:grid-cols-2" style={{ minHeight: altura }}>
        <div className="flex flex-col justify-center gap-5 px-6 py-16 md:px-14">
          {txt(p, "badge") && <Badge>{txt(p, "badge")}</Badge>}
          <h1 className="text-4xl font-bold leading-tight md:text-6xl" style={{ fontFamily: T.fontTitle }}>
            {txt(p, "titulo")}
          </h1>
          {txt(p, "subtitulo") && (
            <p className="max-w-lg text-lg leading-relaxed" style={{ color: T.muted }}>{txt(p, "subtitulo")}</p>
          )}
          <div><Botao href={txt(p, "ctaUrl")}>{txt(p, "ctaTexto")}</Botao></div>
        </div>
        <div
          className="min-h-[320px] bg-cover bg-center"
          style={{ backgroundImage: slideAtual.imagem ? `url(${slideAtual.imagem})` : undefined, background: !slideAtual.imagem ? T.surfaceAlt : undefined }}
        />
      </section>
    );
  }

  return (
    <section className="relative flex w-full overflow-hidden" style={{ minHeight: altura }}>
      {/* Fundo */}
      {variante === "video" && txt(p, "video") ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={txt(p, "video")} autoPlay muted loop playsInline
        />
      ) : variante === "gradient" ? (
        <div className="absolute inset-0" style={{ background: T.heroOverlay }} />
      ) : slideAtual.imagem ? (
        <AnimatePresence mode="wait">
          <motion.div
            // A chave é o índice, não a URL: dois slides com a mesma imagem
            // ainda precisam disparar a transição.
            key={`${indice}-${slideAtual.imagem}`}
            initial={efeito.initial}
            animate={efeito.animate}
            exit={efeito.exit}
            transition={{ duration: efeito.duracao, ease: "easeInOut" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${slideAtual.imagem})` }}
          />
        </AnimatePresence>
      ) : (
        <div className="absolute inset-0" style={{ background: T.surfaceAlt }} />
      )}

      {variante !== "minimal" && variante !== "gradient" && (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
      )}

      <div className={`relative mx-auto flex w-full max-w-5xl flex-col justify-center gap-5 px-6 py-20 ${alinha}`}>
        {txt(p, "badge") && <Badge>{txt(p, "badge")}</Badge>}
        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-4xl font-bold leading-[1.05] md:text-7xl"
          style={{ fontFamily: T.fontTitle }}
        >
          {slideAtual.titulo}
        </motion.h1>
        {slideAtual.subtitulo && (
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }}
            className="max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: "rgba(255,255,255,.85)" }}
          >
            {slideAtual.subtitulo}
          </motion.p>
        )}
        <div className="mt-2"><Botao href={slideAtual.ctaUrl}>{slideAtual.ctaTexto}</Botao></div>

        {ehCarrossel && slides.length > 1 && (
          <div className="mt-8 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i} onClick={() => setAtivo(i)} aria-label={`Slide ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === indice ? 32 : 12, background: i === indice ? T.accent : "rgba(255,255,255,.4)" }}
              />
            ))}
          </div>
        )}
      </div>

      {ehCarrossel && slides.length > 1 && bool(p, "setas", true) && (
        <>
          <SetaHero lado="esq" onClick={() => setAtivo((i) => (i - 1 + slides.length) % slides.length)} />
          <SetaHero lado="dir" onClick={() => setAtivo((i) => (i + 1) % slides.length)} />
        </>
      )}
    </section>
  );
}

function SetaHero({ lado, onClick }: { lado: "esq" | "dir"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={lado === "esq" ? "Slide anterior" : "Próximo slide"}
      className="absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center backdrop-blur transition-opacity hover:opacity-100"
      style={{
        [lado === "esq" ? "left" : "right"]: 16,
        background: "rgba(255,255,255,.2)", color: "#fff", borderRadius: 999, opacity: 0.75,
      }}
    >
      {lado === "esq" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block w-fit px-3 py-1 text-xs font-semibold uppercase tracking-widest"
      style={{ background: T.accent, color: T.bg, borderRadius: 999 }}
    >
      {children}
    </span>
  );
}

// ── Blocos de conteúdo ───────────────────────────────────────────────────────

function Texto({ p, variante }: { p: Props; variante: string }) {
  const conteudo = txt(p, "conteudo");
  const alinhamento = txt(p, "alinhamento", "left");

  if (variante === "citacao") {
    return (
      <Secao className="max-w-3xl text-center">
        <Quote size={40} style={{ color: T.accent }} className="mx-auto mb-5" />
        <p className="text-2xl leading-relaxed md:text-3xl" style={{ fontFamily: T.fontTitle }}>{conteudo}</p>
        {txt(p, "autor") && <p className="mt-5 text-sm uppercase tracking-widest" style={{ color: T.muted }}>{txt(p, "autor")}</p>}
      </Secao>
    );
  }

  return (
    <Secao>
      <div style={{ textAlign: alinhamento as "left" | "center" | "right" }}>
        <TituloSecao>{txt(p, "titulo")}</TituloSecao>
        <div
          className={`whitespace-pre-line text-base leading-relaxed md:text-lg ${
            variante === "duas-colunas" ? "md:columns-2 md:gap-10" : ""
          }`}
          style={{
            color: T.muted,
            ...(variante === "destaque"
              ? { background: T.surface, borderLeft: `4px solid ${T.primary}`, padding: "24px", borderRadius: T.radius }
              : {}),
          }}
        >
          {conteudo}
        </div>
      </div>
    </Secao>
  );
}

function Galeria({ p, variante }: { p: Props; variante: string }) {
  const fotos = list(p, "fotos");
  const colunas = Math.min(Math.max(num(p, "colunas", 3), 1), 6);
  const legendas = bool(p, "legendas");
  if (!fotos.length) return null;

  if (variante === "carrossel") {
    return (
      <Secao>
        <TituloSecao>{txt(p, "titulo")}</TituloSecao>
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {fotos.map((f, i) => (
            <figure key={i} className="w-72 shrink-0 snap-start">
              <img src={txt(f, "url")} alt={txt(f, "legenda")} className="h-56 w-full object-cover" style={{ borderRadius: T.radius }} />
              {legendas && <figcaption className="mt-2 text-sm" style={{ color: T.muted }}>{txt(f, "legenda")}</figcaption>}
            </figure>
          ))}
        </div>
      </Secao>
    );
  }

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div
        className={variante === "mosaico" ? "columns-2 gap-4 md:columns-3" : "grid gap-4"}
        style={variante === "mosaico" ? undefined : { gridTemplateColumns: `repeat(${colunas}, minmax(0,1fr))` }}
      >
        {fotos.map((f, i) => (
          <figure key={i} className={variante === "mosaico" ? "mb-4 break-inside-avoid" : ""}>
            <img
              src={txt(f, "url")} alt={txt(f, "legenda")}
              className={`w-full object-cover ${variante === "mosaico" ? "" : "aspect-square"} ${
                variante === "destaque" && i === 0 ? "md:col-span-2 md:row-span-2" : ""
              }`}
              style={{ borderRadius: T.radius }}
            />
            {legendas && <figcaption className="mt-2 text-sm" style={{ color: T.muted }}>{txt(f, "legenda")}</figcaption>}
          </figure>
        ))}
      </div>
    </Secao>
  );
}

/** Converte URL do YouTube/Vimeo em URL de embed. Outros formatos passam direto. */
function urlEmbed(url: string): string {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function Video({ p, variante }: { p: Props; variante: string }) {
  const url = txt(p, "url");
  if (!url) return null;

  const player = (
    <div className="aspect-video w-full overflow-hidden" style={{ borderRadius: T.radius, boxShadow: T.shadow }}>
      <iframe src={urlEmbed(url)} className="h-full w-full" allowFullScreen title={txt(p, "titulo", "Vídeo")} />
    </div>
  );

  if (variante === "lado-a-lado") {
    return (
      <Secao>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <TituloSecao>{txt(p, "titulo")}</TituloSecao>
            <p className="whitespace-pre-line leading-relaxed" style={{ color: T.muted }}>{txt(p, "descricao")}</p>
          </div>
          {player}
        </div>
      </Secao>
    );
  }

  if (variante === "largura-total") {
    return (
      <section className="w-full">
        <div className="aspect-video w-full">
          <iframe src={urlEmbed(url)} className="h-full w-full" allowFullScreen title={txt(p, "titulo", "Vídeo")} />
        </div>
      </section>
    );
  }

  return <Secao className="max-w-4xl"><TituloSecao>{txt(p, "titulo")}</TituloSecao>{player}</Secao>;
}

function Equipe({ p, variante }: { p: Props; variante: string }) {
  const pessoas = list(p, "pessoas");
  const colunas = Math.min(Math.max(num(p, "colunas", 4), 1), 6);
  if (!pessoas.length) return null;

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${variante === "circulos" ? 140 : 200}px, 1fr))`, maxWidth: colunas * 260 }}>
        {pessoas.map((pes, i) => (
          <div key={i} className={variante === "lista" ? "flex items-center gap-4" : "text-center"}>
            {txt(pes, "foto") ? (
              <img
                src={txt(pes, "foto")} alt={txt(pes, "nome")}
                className={variante === "circulos" ? "mx-auto h-28 w-28 rounded-full object-cover"
                  : variante === "lista" ? "h-16 w-16 rounded-full object-cover"
                  : "aspect-square w-full object-cover"}
                style={variante === "cards" ? { borderRadius: T.radius } : undefined}
              />
            ) : (
              <div className="mx-auto h-28 w-28 rounded-full" style={{ background: T.surfaceAlt }} />
            )}
            <div className={variante === "lista" ? "" : "mt-3"}>
              <p className="font-semibold">{txt(pes, "nome")}</p>
              <p className="text-sm" style={{ color: T.muted }}>{txt(pes, "funcao")}</p>
              {txt(pes, "bio") && variante === "lista" && (
                <p className="mt-1 text-sm" style={{ color: T.muted }}>{txt(pes, "bio")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Depoimentos({ p, variante }: { p: Props; variante: string }) {
  const itens = list(p, "itens");
  if (!itens.length) return null;

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div className={variante === "carrossel" ? "flex snap-x gap-5 overflow-x-auto pb-4" : "grid gap-5 md:grid-cols-3"}>
        {itens.map((d, i) => (
          <blockquote
            key={i}
            className={`p-6 ${variante === "carrossel" ? "w-80 shrink-0 snap-start" : ""}`}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
          >
            <Quote size={22} style={{ color: T.accent }} />
            <p className="mt-3 leading-relaxed" style={{ color: T.muted }}>{txt(d, "texto")}</p>
            <footer className="mt-4 flex items-center gap-3">
              {txt(d, "foto") && <img src={txt(d, "foto")} alt="" className="h-9 w-9 rounded-full object-cover" />}
              <span className="text-sm font-semibold">{txt(d, "nome")}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </Secao>
  );
}

function Numeros({ p, variante }: { p: Props; variante: string }) {
  const itens = list(p, "itens");
  if (!itens.length) return null;

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))` }}>
        {itens.map((n, i) => (
          <div
            key={i} className="text-center"
            style={variante === "cards"
              ? { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "28px 16px" }
              : undefined}
          >
            <p className="text-4xl font-bold md:text-5xl" style={{ color: T.primary, fontFamily: T.fontTitle }}>
              {txt(n, "valor")}
            </p>
            <p className="mt-1 text-sm uppercase tracking-wide" style={{ color: T.muted }}>{txt(n, "rotulo")}</p>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Faq({ p, variante }: { p: Props; variante: string }) {
  const itens = list(p, "itens");
  const [aberto, setAberto] = useState<number | null>(0);
  if (!itens.length) return null;

  return (
    <Secao className="max-w-4xl">
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div className={variante === "duas-colunas" ? "grid gap-3 md:grid-cols-2" : "flex flex-col gap-3"}>
        {itens.map((f, i) => {
          const expandido = aberto === i;
          return (
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
              <button
                onClick={() => setAberto(expandido ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left font-medium"
                aria-expanded={expandido}
              >
                {txt(f, "pergunta")}
                <ChevronDown size={18} className="shrink-0 transition-transform" style={{ transform: expandido ? "rotate(180deg)" : undefined, color: T.muted }} />
              </button>
              <AnimatePresence initial={false}>
                {expandido && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 leading-relaxed" style={{ color: T.muted }}>{txt(f, "resposta")}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Secao>
  );
}

function Agenda({ p, variante }: { p: Props; variante: string }) {
  const itens = list(p, "itens");
  if (!itens.length) return null;

  const grupos = variante === "semana"
    ? itens.reduce<Record<string, Props[]>>((acc, it) => {
        const dia = txt(it, "dia", "Outros");
        (acc[dia] ??= []).push(it);
        return acc;
      }, {})
    : { "": itens };

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div className="flex flex-col gap-6">
        {Object.entries(grupos).map(([dia, lista]) => (
          <div key={dia}>
            {dia && <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest" style={{ color: T.accent }}>{dia}</h3>}
            <div className="flex flex-col gap-2">
              {lista.map((it, i) => (
                <div
                  key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
                >
                  <span className="flex items-center gap-2 font-semibold" style={{ color: T.primary }}>
                    <Clock size={15} />{txt(it, "hora")}
                  </span>
                  <span>{txt(it, "descricao")}</span>
                  {txt(it, "local") && (
                    <span className="flex items-center gap-1 text-sm" style={{ color: T.muted }}>
                      <MapPin size={13} />{txt(it, "local")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Cta({ p, variante }: { p: Props; variante: string }) {
  const conteudo = (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: T.fontTitle }}>{txt(p, "titulo")}</h2>
      {txt(p, "subtitulo") && <p className="max-w-2xl" style={{ color: variante === "imagem" ? "rgba(255,255,255,.85)" : T.muted }}>{txt(p, "subtitulo")}</p>}
      <Botao href={txt(p, "ctaUrl")}>{txt(p, "ctaTexto")}</Botao>
    </div>
  );

  if (variante === "imagem") {
    return (
      <section
        className="relative bg-cover bg-center px-5 py-24"
        style={{ backgroundImage: txt(p, "imagem") ? `url(${txt(p, "imagem")})` : undefined, background: !txt(p, "imagem") ? T.heroOverlay : undefined }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.55)" }} />
        <div className="relative mx-auto max-w-4xl">{conteudo}</div>
      </section>
    );
  }

  if (variante === "faixa") {
    return <section className="px-5 py-16" style={{ background: T.heroOverlay }}><div className="mx-auto max-w-4xl">{conteudo}</div></section>;
  }

  return (
    <Secao className="max-w-4xl">
      <div className="p-10" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow }}>
        {conteudo}
      </div>
    </Secao>
  );
}

function Mapa({ p, variante }: { p: Props; variante: string }) {
  const endereco = txt(p, "endereco");
  if (!endereco) return null;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(endereco)}&z=${num(p, "zoom", 15)}&output=embed`;

  const mapa = (
    <iframe
      src={src} className="h-80 w-full border-0" loading="lazy"
      style={{ borderRadius: T.radius }} title="Mapa"
    />
  );

  if (variante === "lado-a-lado") {
    return (
      <Secao>
        <div className="grid items-center gap-8 md:grid-cols-2">
          {mapa}
          <div>
            <TituloSecao>{txt(p, "titulo")}</TituloSecao>
            <p className="flex items-start gap-2" style={{ color: T.muted }}>
              <MapPin size={18} className="mt-0.5 shrink-0" />{endereco}
            </p>
            <div className="mt-5">
              <Botao href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}>
                Traçar rota
              </Botao>
            </div>
          </div>
        </div>
      </Secao>
    );
  }

  return <Secao><TituloSecao>{txt(p, "titulo")}</TituloSecao>{mapa}<p className="mt-3 text-sm" style={{ color: T.muted }}>{endereco}</p></Secao>;
}

function Contato({ p, variante, site }: { p: Props; variante: string; site: DepartmentSite }) {
  const canais = [
    { icone: MessageCircle, rotulo: "WhatsApp", valor: txt(p, "whatsapp") || site.whatsapp_number || "",
      href: (v: string) => `https://wa.me/${v.replace(/\D/g, "")}` },
    { icone: AtSign, rotulo: "Instagram", valor: txt(p, "instagram") || site.instagram || "",
      href: (v: string) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace("@", "")}`) },
    { icone: PlayCircle, rotulo: "YouTube", valor: txt(p, "youtube") || site.youtube || "", href: (v: string) => v },
    { icone: Mail, rotulo: "E-mail", valor: txt(p, "email"), href: (v: string) => `mailto:${v}` },
  ].filter((c) => c.valor);

  if (!canais.length) return null;

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      <div className={variante === "cards" ? "grid gap-4 md:grid-cols-4" : "flex flex-wrap gap-4"}>
        {canais.map((c) => (
          <a
            key={c.rotulo} href={c.href(c.valor)} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-5 py-4 transition-transform hover:scale-[1.02]"
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
          >
            <c.icone size={20} style={{ color: T.primary }} />
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: T.muted }}>{c.rotulo}</p>
              <p className="text-sm font-medium">{c.valor}</p>
            </div>
          </a>
        ))}
      </div>
    </Secao>
  );
}

function Espacador({ p, variante }: { p: Props; variante: string }) {
  const alturas: Record<string, number> = { sm: 32, md: 64, lg: 112 };
  const h = alturas[txt(p, "altura", "md")] ?? 64;

  if (variante === "linha") {
    return <div className="mx-auto max-w-6xl px-5"><hr style={{ borderColor: T.border, margin: `${h / 2}px 0` }} /></div>;
  }
  if (variante === "onda") {
    return (
      <div style={{ height: h, background: T.surface, borderRadius: `0 0 50% 50% / 0 0 ${h}px ${h}px` }} />
    );
  }
  return <div style={{ height: h }} />;
}

// ── Formulário genérico de contato ───────────────────────────────────────────

function Formulario({ p, variante, slug }: { p: Props; variante: string; slug: string }) {
  const campos = list(p, "campos");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const dados = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch(`/api/public/dept/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assunto: txt(p, "titulo"), dados }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Não foi possível enviar.");
      setEnviado(true);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const form = enviado ? (
    <p className="p-6 text-center" style={{ background: T.surface, borderRadius: T.radius, color: T.muted }}>
      {txt(p, "mensagemSucesso", "Recebemos seu contato!")}
    </p>
  ) : (
    <form onSubmit={enviar} className={variante === "compacto" ? "flex gap-2" : "flex flex-col gap-3"}>
      {campos.map((c, i) => {
        const nome = txt(c, "label") || `campo_${i}`;
        const tipo = txt(c, "tipo", "text");
        const comum = {
          name: nome,
          required: bool(c, "obrigatorio"),
          placeholder: txt(c, "label"),
          className: "w-full px-4 py-3 text-sm outline-none",
          style: { background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text },
        };
        return tipo === "textarea"
          ? <textarea key={i} {...comum} rows={4} />
          : <input key={i} {...comum} type={tipo === "cpf" ? "text" : tipo} inputMode={tipo === "cpf" || tipo === "tel" ? "numeric" : undefined} />;
      })}
      {erro && <p className="text-sm" style={{ color: "#ef4444" }}>{erro}</p>}
      <button
        type="submit" disabled={enviando}
        className="px-6 py-3 text-sm font-semibold disabled:opacity-60"
        style={{ background: T.primary, color: "#fff", borderRadius: T.radius }}
      >
        {enviando ? "Enviando…" : txt(p, "textoBotao", "Enviar")}
      </button>
    </form>
  );

  if (variante === "lado-a-lado") {
    return (
      <Secao>
        <div className="grid items-start gap-10 md:grid-cols-2">
          <div>
            <TituloSecao>{txt(p, "titulo")}</TituloSecao>
            <p style={{ color: T.muted }}>{txt(p, "descricao")}</p>
          </div>
          {form}
        </div>
      </Secao>
    );
  }

  return (
    <Secao className="max-w-2xl">
      <TituloSecao>{txt(p, "titulo")}</TituloSecao>
      {txt(p, "descricao") && <p className="mb-6" style={{ color: T.muted }}>{txt(p, "descricao")}</p>}
      {form}
    </Secao>
  );
}

// ── Rodapé ───────────────────────────────────────────────────────────────────

function Rodape({ site }: { site: DepartmentSite }) {
  return (
    <footer className="px-5 py-10" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
        <p className="font-semibold" style={{ fontFamily: T.fontTitle }}>{site.titulo}</p>
        <div className="flex gap-4">
          {site.instagram && (
            <a href={site.instagram.startsWith("http") ? site.instagram : `https://instagram.com/${site.instagram.replace("@", "")}`}
               target="_blank" rel="noreferrer" aria-label="Instagram"><AtSign size={18} style={{ color: T.muted }} /></a>
          )}
          {site.youtube && <a href={site.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><PlayCircle size={18} style={{ color: T.muted }} /></a>}
          {site.whatsapp_number && (
            <a href={`https://wa.me/${site.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <MessageCircle size={18} style={{ color: T.muted }} />
            </a>
          )}
        </div>
        <p className="text-xs" style={{ color: T.muted }}>
          © {new Date().getFullYear()} {site.titulo}
        </p>
      </div>
    </footer>
  );
}

export { T as tokens, Secao, TituloSecao, Botao, Badge, Calendar, ShoppingBag };
