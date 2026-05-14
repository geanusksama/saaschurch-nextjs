import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

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
