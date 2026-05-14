import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get("churchId");
    const scopeChurchId = churchId || user.churchId;
    const where = { deletedAt: null, ...(scopeChurchId ? { churchId: scopeChurchId } : {}) };
    const cells = await prisma.cellGroup.findMany({
      where,
      include: {
        leader: { select: { fullName: true, mobile: true, phone: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(cells));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { name, network, leaderId, address, location, meetingDay, meetingTime, churchId, color, photo } = body;
    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    const churchIdToUse = churchId || user.churchId;
    if (!churchIdToUse) return NextResponse.json({ error: "Igreja é obrigatória" }, { status: 400 });
    const newCell = await prisma.cellGroup.create({
      data: {
        name, cellType: network || null, leaderId: leaderId || null,
        address, description: location || null, meetingDay,
        meetingTime: meetingTime ? new Date(`1970-01-01T${meetingTime}:00Z`) : null,
        churchId: churchIdToUse,
      },
    });
    return NextResponse.json(serializeBigInts(newCell), { status: 201 });
  });
}
