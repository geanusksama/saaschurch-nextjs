import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const contacts = await prisma.churchContact.findMany({
      where: { churchId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(serializeBigInts(contacts));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { type, name, value, notes, isPrimary } = body;
    if (!type || !value) return NextResponse.json({ error: "type and value are required" }, { status: 400 });
    if (isPrimary) {
      await prisma.churchContact.updateMany({
        where: { churchId, type, deletedAt: null },
        data: { isPrimary: false },
      });
    }
    const contact = await prisma.churchContact.create({
      data: { churchId, type, name, value, notes, isPrimary: Boolean(isPrimary) },
    });
    return NextResponse.json(serializeBigInts(contact), { status: 201 });
  });
}
