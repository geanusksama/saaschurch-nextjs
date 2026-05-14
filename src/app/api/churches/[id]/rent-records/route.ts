import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

function parseNumberValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Number(value);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const records = await prisma.churchRentRecord.findMany({
      where: { churchId, deletedAt: null },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(serializeBigInts(records));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const church = await prisma.church.findFirst({ where: { id: churchId, deletedAt: null } });
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const { city, address, amount, ownerName, ownerDocumentType, ownerDocumentNumber, paidAt, receiptUrl, notes, isActive } = body;
    if (!city || !address || amount === undefined || amount === null || !paidAt) {
      return NextResponse.json({ error: "city, address, amount and paidAt are required" }, { status: 400 });
    }
    const record = await prisma.churchRentRecord.create({
      data: { churchId, city, address, amount: parseNumberValue(amount), ownerName, ownerDocumentType, ownerDocumentNumber, paidAt: new Date(paidAt), receiptUrl, notes, isActive: isActive ?? true },
    });
    return NextResponse.json(serializeBigInts(record), { status: 201 });
  });
}
