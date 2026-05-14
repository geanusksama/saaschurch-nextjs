import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchContact.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "contact not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.isPrimary) {
      await prisma.churchContact.updateMany({
        where: { churchId: existing.churchId, type: body.type || existing.type, deletedAt: null },
        data: { isPrimary: false },
      });
    }
    const updated = await prisma.churchContact.update({ where: { id }, data: body });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchContact.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "contact not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.churchContact.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  });
}
