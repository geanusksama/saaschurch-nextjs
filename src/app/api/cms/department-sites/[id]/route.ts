import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSiteForCampo } from "@/lib/departmentSiteService";

const PERFIS_CMS = ["master", "admin", "campo", "regional", "church"];

/** Campos do site que o CMS pode alterar. Nada fora desta lista é aceito. */
const CAMPOS_EDITAVEIS = [
  "titulo", "subtitulo", "descricao", "logo_url", "favicon_url",
  "cor_primaria", "cor_secundaria", "cor_destaque", "tema", "preset", "tokens_override",
  "seo_title", "seo_description", "og_image_url",
  "payment_link", "whatsapp_number", "instagram", "youtube", "slug",
] as const;

async function autorizar(req: NextRequest) {
  const user = await getAuthUser(req).catch(() => null);
  if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  if (!user.campoId) {
    return { erro: NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 }) };
  }
  return { user, campoId: user.campoId };
}

// GET /api/cms/department-sites/[id] — site + blocos (rascunho)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;
  const { id } = await ctx.params;

  const dados = await getSiteForCampo(id, auth.campoId!);
  if (!dados) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  return NextResponse.json(dados);
}

// PATCH /api/cms/department-sites/[id] — salva ajustes do site e/ou os blocos
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;
  const { id } = await ctx.params;

  // Confere a posse antes de qualquer escrita: service_role ignora RLS.
  const atual = await getSiteForCampo(id, auth.campoId!);
  if (!atual) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });

  const body = await req.json();

  // ── 1. Atributos do site ────────────────────────────────────────────────
  const patch: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) patch[campo] = body[campo];
  }
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin
      .from("department_sites").update(patch)
      .eq("id", id).eq("campo_id", auth.campoId!);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // ── 2. Blocos ───────────────────────────────────────────────────────────
  // O builder envia a lista inteira na ordem em que está na tela. Sincronizamos
  // por diferença (insere/atualiza/remove) em vez de apagar tudo e reinserir,
  // para não perder o snapshot `props_publicado` do que já está no ar.
  if (Array.isArray(body.blocks)) {
    const enviados = body.blocks as Array<{
      id?: string; tipo: string; variante?: string; props?: Record<string, unknown>; visivel?: boolean;
    }>;

    const idsEnviados = new Set(enviados.map((b) => b.id).filter(Boolean) as string[]);
    const paraRemover = atual.blocks.filter((b) => !idsEnviados.has(b.id)).map((b) => b.id);

    if (paraRemover.length) {
      await supabaseAdmin.from("department_site_blocks").delete().in("id", paraRemover);
    }

    for (const [ordem, bloco] of enviados.entries()) {
      const linha = {
        site_id: id,
        campo_id: auth.campoId!,
        tipo: bloco.tipo,
        variante: bloco.variante || "default",
        ordem,
        props: bloco.props ?? {},
        visivel: bloco.visivel ?? true,
      };
      if (bloco.id && atual.blocks.some((b) => b.id === bloco.id)) {
        await supabaseAdmin.from("department_site_blocks").update(linha).eq("id", bloco.id);
      } else {
        await supabaseAdmin.from("department_site_blocks").insert(linha);
      }
    }
  }

  return NextResponse.json(await getSiteForCampo(id, auth.campoId!));
}

// DELETE /api/cms/department-sites/[id] — arquiva (soft delete)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await autorizar(req);
  if (auth.erro) return auth.erro;
  const { id } = await ctx.params;

  const { error } = await supabaseAdmin
    .from("department_sites")
    .update({ deleted_at: new Date().toISOString(), status: "RASCUNHO" })
    .eq("id", id).eq("campo_id", auth.campoId!);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
