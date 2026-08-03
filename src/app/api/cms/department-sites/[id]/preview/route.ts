import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  getSiteForCampo, getDepartmentEvents, getDepartmentProducts,
} from "@/lib/departmentSiteService";

const PERFIS_CMS = ["master", "admin", "campo", "regional", "church"];

/**
 * GET /api/cms/department-sites/[id]/preview
 *
 * Eventos e produtos do departamento para a pré-visualização do builder.
 *
 * A rota pública `/api/public/dept/[slug]` só serve páginas PUBLICADAS — e o
 * ponto do preview é justamente ver o rascunho antes de publicar. Por isso
 * existe esta versão autenticada: mesmos dados, sem exigir que a página esteja
 * no ar.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req).catch(() => null);
    if (!user || !PERFIS_CMS.includes(user.profileType || "")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (!user.campoId) {
      return NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 });
    }

    const { id } = await ctx.params;
    const dados = await getSiteForCampo(id, user.campoId);
    if (!dados?.site.campo_id) {
      return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
    }

    const [eventos, produtos] = await Promise.all([
      getDepartmentEvents(dados.site.department_id, dados.site.campo_id),
      getDepartmentProducts(dados.site.department_id, dados.site.campo_id),
    ]);

    return NextResponse.json({ eventos, produtos });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
