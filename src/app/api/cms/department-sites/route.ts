import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listSites } from "@/lib/departmentSiteService";
import { DEFAULT_PRESET_ID } from "@/lib/departmentSiteSchema";

/** Perfis que podem administrar as páginas dos departamentos. */
const PERFIS_CMS = ["master", "admin", "campo", "regional", "church"];

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// GET /api/cms/department-sites — sites do campo do usuário
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req).catch(() => null);
    if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Master pode inspecionar outro campo; os demais ficam presos ao seu.
    const campoId =
      user.profileType === "master" && req.nextUrl.searchParams.get("campoId")
        ? req.nextUrl.searchParams.get("campoId")!
        : user.campoId;

    if (!campoId) {
      return NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 });
    }

    return NextResponse.json({ sites: await listSites(campoId) });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// POST /api/cms/department-sites — cria o site de um departamento
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req).catch(() => null);
    if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (!user.campoId) {
      return NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 });
    }

    const body = await req.json();
    const departmentId: string | undefined = body.departmentId;
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId é obrigatório." }, { status: 400 });
    }

    // O departamento precisa ser do mesmo campo — senão um campo criaria
    // páginas dentro de outro.
    const { data: dept } = await supabaseAdmin
      .from("ministries")
      .select("id, name, color, campo_id")
      .eq("id", departmentId)
      .maybeSingle();

    if (!dept || dept.campo_id !== user.campoId) {
      return NextResponse.json({ error: "Departamento não pertence ao seu campo." }, { status: 403 });
    }

    const slugBase = slugify(body.slug || dept.name);
    if (!slugBase) {
      return NextResponse.json({ error: "Não foi possível gerar o endereço da página." }, { status: 400 });
    }

    // Desambigua o slug dentro do campo: jovens, jovens-2, jovens-3…
    let slug = slugBase;
    for (let i = 2; i < 50; i++) {
      const { data: existe } = await supabaseAdmin
        .from("department_sites")
        .select("id").eq("campo_id", user.campoId).ilike("slug", slug)
        .is("deleted_at", null).maybeSingle();
      if (!existe) break;
      slug = `${slugBase}-${i}`;
    }

    const { data, error } = await supabaseAdmin
      .from("department_sites")
      .insert({
        campo_id: user.campoId,
        department_id: departmentId,
        slug,
        titulo: body.titulo || dept.name,
        cor_primaria: dept.color || "#7C5CFF",
        preset: body.preset || DEFAULT_PRESET_ID,
        status: "RASCUNHO",
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ site: data }, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
