import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedSiteBySlug,
  getDepartmentEvents,
  getDepartmentProducts,
} from "@/lib/departmentSiteService";
import { resolveCampoFromRequest } from "@/lib/publicTenant";

/**
 * GET /api/public/dept/[slug]
 *
 * Conteúdo público da página de um departamento — o que a rota `/jovens`
 * renderiza. Sem autenticação: devolve apenas o que está PUBLICADO.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const campoId = await resolveCampoFromRequest(req);

    const dados = await getPublishedSiteBySlug(slug, campoId);
    if (!dados) {
      return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
    }

    const { site, blocks, departamento } = dados;

    // Eventos e produtos só são buscados se a página realmente os usa —
    // uma página só de texto não paga o custo dessas consultas.
    const usaEventos = blocks.some((b) => b.tipo === "eventos");
    const usaLoja = blocks.some((b) => b.tipo === "loja");

    const [eventos, produtos] = await Promise.all([
      usaEventos && site.campo_id
        ? getDepartmentEvents(site.department_id, site.campo_id)
        : Promise.resolve({ abertos: [], historico: [] }),
      usaLoja && site.campo_id
        ? getDepartmentProducts(site.department_id, site.campo_id)
        : Promise.resolve([]),
    ]);

    return NextResponse.json(
      { site, blocks, departamento, eventos, produtos },
      // Cache curto na borda: a página é pública e muda pouco, mas o botão de
      // inscrição depende do relógio, então nada de cache longo.
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
