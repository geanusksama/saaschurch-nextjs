import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess } from "@/lib/helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.legacyChurchPhoto.findUnique({ where: { id } });
    if (!existing?.churchId) return NextResponse.json({ error: "photo not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.legacyChurchPhoto.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
