import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, description, serviceId, isActive } = body;
    const existing = await prisma.kanStage.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "stage not found" }, { status: 404 });
    const updated = await prisma.kanStage.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(serviceId !== undefined && { serviceId: serviceId ? Number(serviceId) : null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { service: true, columns: { orderBy: { columnIndex: "asc" } } },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const existing = await prisma.kanStage.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "stage not found" }, { status: 404 });
    await prisma.kanStage.update({ where: { id: Number(id) }, data: { isActive: false } });
    return new NextResponse(null, { status: 204 });
  });
}
