import { NextResponse } from "next/server";
import { listPublicGfs } from "@/lib/gfPublicListService";

// GET /api/public/gf-list
// Lista pública (sem auth) dos Grupos Familiares ativos: nome, líder, contato,
// endereço, coordenadas, foto de capa e horário. É o que a home usa para
// mostrar o ícone "Grupos Familiares" -> lista -> mapa/distância.
export async function GET() {
  try {
    const data = await listPublicGfs();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/public/gf-list]", e);
    return NextResponse.json({ error: "Erro ao carregar Grupos Familiares." }, { status: 500 });
  }
}
