import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const serviceId = Number(id);
    const rules = await prisma.kanMatrixRule.findMany({
      where: { serviceId, isActive: true },
      orderBy: { columnIndex: "asc" },
    });
    const colIndices = [...new Set(rules.map((r) => r.columnIndex))];
    if (colIndices.length === 0) return NextResponse.json([]);
    const allStages = await prisma.kanStage.findMany({
      where: { serviceId, isActive: true },
      include: { columns: true },
    });
    const colNameMap: Record<number, string> = {};
    for (const stage of allStages) {
      for (const col of stage.columns) {
        colNameMap[col.columnIndex] = colNameMap[col.columnIndex] || col.name;
      }
    }
    return NextResponse.json(serializeBigInts(rules.map((r) => ({ ...r, columnName: colNameMap[r.columnIndex] || null }))));
  });
}
