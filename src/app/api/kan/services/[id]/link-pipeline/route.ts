import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const serviceId = Number(id);
    const body = await req.json().catch(() => ({}));
    const { pipelineId, copyFromStageId, stageName, columns } = body;
    if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });

    const stage = await prisma.kanStage.create({
      data: { pipelineId: Number(pipelineId), serviceId, name: stageName || "Principal", isActive: true },
    });

    let colDefs: Array<{ name: string; color?: string; columnIndex?: number }> = [];
    if (copyFromStageId) {
      colDefs = await prisma.kanColumn.findMany({ where: { stageId: Number(copyFromStageId) }, orderBy: { columnIndex: "asc" } });
    } else if (Array.isArray(columns) && columns.length) {
      colDefs = columns.map((c: { name: string; color?: string; columnIndex?: number }, i: number) => ({
        name: c.name, color: c.color || "blue", columnIndex: c.columnIndex ?? i + 1,
      }));
    }

    const createdCols = [];
    for (const c of colDefs) {
      const col = await prisma.kanColumn.create({ data: { stageId: stage.id, name: c.name, color: c.color || "blue", columnIndex: c.columnIndex ?? 1 } });
      createdCols.push(col);
    }

    const createdRules = [];
    for (const col of createdCols) {
      try {
        const rule = await prisma.kanMatrixRule.create({
          data: { serviceId, columnIndex: col.columnIndex, stageId: stage.id, insertOccurrence: true, isActive: true },
        });
        createdRules.push(rule);
      } catch (_e) { /* unique constraint */ }
    }

    return NextResponse.json(serializeBigInts({ stage, columns: createdCols, rules: createdRules }), { status: 201 });
  });
}
