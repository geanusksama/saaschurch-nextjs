import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const stages = await prisma.kanStage.findMany({
      where: { pipelineId: Number(id), isActive: true },
      include: { service: true, columns: { orderBy: { columnIndex: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(serializeBigInts(stages));
  });
}
