import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSiteForCampo } from "@/lib/departmentSiteService";

const PERFIS_CMS = ["master", "admin", "campo", "regional", "church"];

/**
 * POST /api/cms/department-sites/[id]/publish
 *
 * Congela o rascunho como versão pública: copia `props` → `props_publicado` em
 * todos os blocos e marca o site como PUBLICADO. Enquanto isso não acontece, o
 * visitante continua vendo a versão anterior.
 *
 * Body: { publicar?: boolean }  — false despublica (tira do ar).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req).catch(() => null);
    if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (!user.campoId) {
      return NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 });
    }

    const { id } = await ctx.params;
    const atual = await getSiteForCampo(id, user.campoId);
    if (!atual) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const publicar = body.publicar !== false;

    if (!publicar) {
      await supabaseAdmin.from("department_sites")
        .update({ status: "RASCUNHO" }).eq("id", id).eq("campo_id", user.campoId);
      return NextResponse.json({ ok: true, status: "RASCUNHO" });
    }

    // Uma página sem nenhum bloco visível no ar seria uma tela em branco.
    if (!atual.blocks.some((b) => b.visivel)) {
      return NextResponse.json(
        { error: "Adicione ao menos um bloco visível antes de publicar." },
        { status: 400 },
      );
    }

    // Congela o rascunho bloco a bloco.
    for (const bloco of atual.blocks) {
      await supabaseAdmin.from("department_site_blocks")
        .update({ props_publicado: bloco.props }).eq("id", bloco.id);
    }

    const { data, error } = await supabaseAdmin
      .from("department_sites")
      .update({
        status: "PUBLICADO",
        published_at: new Date().toISOString(),
        published_by: user.sub,
      })
      .eq("id", id).eq("campo_id", user.campoId)
      .select("id, slug, status, published_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      site: data,
      // Link pronto para o departamento compartilhar.
      url: `/${data.slug}`,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
