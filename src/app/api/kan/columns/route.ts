import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

/**
 * Etapas (colunas) dos pipelines agrupadas por serviceGroup — BATISMO, CONSAGRACAO,
 * TRANSFERENCIA, REQUERIMENTO, CREDENCIAL. Usado pelos filtros "Etapas do fluxo" dos
 * relatórios, que antes derivavam as opções dos cards já carregados e por isso ficavam
 * vazios enquanto o usuário não clicasse em Consultar.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const columns = await prisma.kanColumn.findMany({
      where: { stage: { is: { isActive: true } } },
      select: {
        id: true,
        name: true,
        columnIndex: true,
        color: true,
        stage: { select: { service: { select: { serviceGroup: true } } } },
      },
      orderBy: [{ columnIndex: "asc" }, { name: "asc" }],
    });

    const grouped: Record<string, Array<{ id: number; name: string; columnIndex: number; color: string | null }>> = {};
    const seen = new Set<string>();

    for (const column of columns) {
      const group = column.stage?.service?.serviceGroup || "OUTROS";
      // O mesmo nome de etapa pode existir em vários stages do mesmo grupo.
      const key = `${group}::${column.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({ id: column.id, name: column.name, columnIndex: column.columnIndex, color: column.color });
    }

    return NextResponse.json(serializeBigInts(grouped));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}));
    const { stageId, name, color } = body;
    if (!stageId || !name) return NextResponse.json({ error: "stageId and name required" }, { status: 400 });
    const max = await prisma.kanColumn.aggregate({ where: { stageId: Number(stageId) }, _max: { columnIndex: true } });
    const nextIndex = (max._max.columnIndex || 0) + 1;
    const column = await prisma.kanColumn.create({
      data: { stageId: Number(stageId), name, color: color || "gray", columnIndex: nextIndex },
    });
    return NextResponse.json(serializeBigInts(column), { status: 201 });
  });
}
