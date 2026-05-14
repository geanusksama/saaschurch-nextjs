import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}));
    const { pipelineId, name, description, serviceId } = body;
    if (!pipelineId || !name) return NextResponse.json({ error: "pipelineId and name required" }, { status: 400 });
    const stage = await prisma.kanStage.create({
      data: {
        pipelineId: Number(pipelineId),
        name,
        description: description || null,
        serviceId: serviceId ? Number(serviceId) : null,
        isActive: true,
      },
      include: { service: true, columns: { orderBy: { columnIndex: "asc" } } },
    });
    return NextResponse.json(serializeBigInts(stage), { status: 201 });
  });
}
