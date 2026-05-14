import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

function parseNumberValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Number(value);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchRentRecord.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "rent record not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const updated = await prisma.churchRentRecord.update({
      where: { id },
      data: {
        city: body.city || undefined,
        address: body.address || undefined,
        amount: body.amount === undefined ? undefined : parseNumberValue(body.amount),
        ownerName: body.ownerName === undefined ? undefined : body.ownerName,
        ownerDocumentType: body.ownerDocumentType === undefined ? undefined : body.ownerDocumentType,
        ownerDocumentNumber: body.ownerDocumentNumber === undefined ? undefined : body.ownerDocumentNumber,
        paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
        receiptUrl: body.receiptUrl === undefined ? undefined : body.receiptUrl,
        notes: body.notes,
        isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchRentRecord.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "rent record not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.churchRentRecord.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return new NextResponse(null, { status: 204 });
  });
}
