import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, color, columnIndex } = body;
    const existing = await prisma.kanColumn.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "column not found" }, { status: 404 });
    const updated = await prisma.kanColumn.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(columnIndex !== undefined && { columnIndex: Number(columnIndex) }),
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const existing = await prisma.kanColumn.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "column not found" }, { status: 404 });
    await prisma.kanColumn.delete({ where: { id: Number(id) } });
    return new NextResponse(null, { status: 204 });
  });
}
