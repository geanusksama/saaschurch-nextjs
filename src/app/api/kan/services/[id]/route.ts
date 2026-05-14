import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { sigla, description, servico, usesMatrix, isActive } = body;
    const existing = await prisma.kanService.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "service not found" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (sigla !== undefined) data.sigla = sigla;
    if (description !== undefined) data.description = description;
    if (servico !== undefined) data.servico = servico;
    if (usesMatrix !== undefined) data.usesMatrix = usesMatrix;
    if (isActive !== undefined) data.isActive = isActive;
    const updated = await prisma.kanService.update({ where: { id: Number(id) }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const existing = await prisma.kanService.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "service not found" }, { status: 404 });
    await prisma.kanService.update({ where: { id: Number(id) }, data: { isActive: false } });
    return new NextResponse(null, { status: 204 });
  });
}
