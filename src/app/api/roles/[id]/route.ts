import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Cargo não encontrado." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const { name, description, permissions } = body;
    const updated = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(permissions !== undefined && { permissions }),
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const existing = await prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Cargo não encontrado." }, { status: 404 });
    await prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  });
}
