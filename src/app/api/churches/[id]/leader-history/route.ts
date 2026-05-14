import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const records = await prisma.churchLeaderHistory.findMany({
      where: { churchId },
      include: {
        previousLeaderMember: { select: { id: true, fullName: true } },
        newLeaderMember: { select: { id: true, fullName: true } },
        function: { select: { id: true, name: true } },
      },
      orderBy: { entryDate: "desc" },
    });
    return NextResponse.json(serializeBigInts(records));
  });
}
