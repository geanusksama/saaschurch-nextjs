import { NextResponse } from "next/server";
import { listPublicGfs, getPublicSede } from "@/lib/gfPublicListService";

// GET /api/public/gf-list
// Lista pública (sem auth) dos Grupos Familiares ativos + a igreja SEDE, que
// fica no centro do mapa da página /gf com os GFs ligados a ela.
export async function GET() {
  try {
    const [groups, sede] = await Promise.all([listPublicGfs(), getPublicSede()]);
    return NextResponse.json({ sede, groups });
  } catch (e) {
    console.error("[GET /api/public/gf-list]", e);
    return NextResponse.json({ error: "Erro ao carregar Grupos Familiares." }, { status: 500 });
  }
}
