import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  getPublishedSiteBySlug,
  getDepartmentEvents,
  getDepartmentProducts,
} from "@/lib/departmentSiteService";
import { getPreset, tokensToCssVars } from "@/lib/departmentSiteSchema";
import DeptSiteRenderer from "@/components/public/dept/DeptSiteRenderer";

/**
 * Página pública de um departamento — o que o link compartilhado abre.
 *
 * Renderizada no servidor para que o compartilhamento no WhatsApp mostre
 * título e imagem, e para que o primeiro paint não dependa de JavaScript.
 *
 * O middleware reescreve `/jovens` para cá, então a URL que o usuário vê é a
 * curta; esta rota é o destino interno.
 */

export const revalidate = 60;

async function campoDoHost(): Promise<string | null> {
  // Em produção o domínio identifica o campo. Reaproveita a mesma resolução
  // da API pública, mas a partir dos headers do request de renderização.
  const h = await headers();
  const host = h.get("host") ?? "";
  const { resolveCampoFromRequest } = await import("@/lib/publicTenant");
  return resolveCampoFromRequest({
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (k: string) => (k === "host" ? host : null) },
  } as never);
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const dados = await getPublishedSiteBySlug(slug, await campoDoHost());
  if (!dados) return { title: "Página não encontrada" };

  const { site } = dados;
  const titulo = site.seo_title || site.titulo;
  const descricao = site.seo_description || site.subtitulo || site.descricao || "";

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      images: site.og_image_url ? [site.og_image_url] : undefined,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: titulo, description: descricao },
    icons: site.favicon_url ? { icon: site.favicon_url } : undefined,
  };
}

export default async function DeptPage(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | undefined>>;
  },
) {
  const { slug } = await params;
  const sp = await searchParams;

  const dados = await getPublishedSiteBySlug(slug, sp.campo ?? (await campoDoHost()));
  if (!dados) notFound();

  const { site, blocks, departamento } = dados;

  // Site sem tenant é dado órfão — não deve ser servido a ninguém.
  const campoId = site.campo_id;
  if (!campoId) notFound();

  const usaEventos = blocks.some((b) => b.tipo === "eventos");
  const usaLoja = blocks.some((b) => b.tipo === "loja");

  const [eventos, produtos] = await Promise.all([
    usaEventos ? getDepartmentEvents(site.department_id, campoId)
              : Promise.resolve({ abertos: [], historico: [] }),
    usaLoja ? getDepartmentProducts(site.department_id, campoId)
            : Promise.resolve([]),
  ]);

  const preset = getPreset(site.preset);
  const cssVars = tokensToCssVars(preset.tokens, site.tokens_override ?? {});

  return (
    <div
      style={cssVars as React.CSSProperties}
      data-tema={preset.tema}
      className="min-h-screen"
    >
      <DeptSiteRenderer
        site={site}
        blocks={blocks}
        departamento={departamento}
        eventos={eventos}
        produtos={produtos}
        modo="publicado"
        slug={slug}
      />
    </div>
  );
}
