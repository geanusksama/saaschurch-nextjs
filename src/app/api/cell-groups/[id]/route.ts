import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const cell = await prisma.cellGroup.findUnique({
      where: { id },
      include: {
        leader: { select: { fullName: true, mobile: true, phone: true } },
        members: { include: { member: { select: { id: true, fullName: true, photoUrl: true, mobile: true } } } },
        meetings: { orderBy: { meetingDate: "desc" }, take: 5 },
      },
    });
    if (!cell) return NextResponse.json({ error: "GF não encontrado" }, { status: 404 });
    return NextResponse.json(serializeBigInts(cell));
  });
}
