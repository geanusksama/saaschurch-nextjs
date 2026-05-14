import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, type, description, isActive } = body;
    const existing = await prisma.kanPipeline.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "pipeline not found" }, { status: 404 });
    const updated = await prisma.kanPipeline.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const existing = await prisma.kanPipeline.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "pipeline not found" }, { status: 404 });
    await prisma.kanPipeline.update({ where: { id: Number(id) }, data: { isActive: false } });
    return new NextResponse(null, { status: 204 });
  });
}
