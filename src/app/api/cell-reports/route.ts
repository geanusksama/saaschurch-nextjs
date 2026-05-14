import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const cellGroupId = searchParams.get("cellGroupId");
    const churchId = searchParams.get("churchId");

    const where: Record<string, unknown> = {};
    if (cellGroupId) where.cellGroupId = cellGroupId;
    if (churchId) where.cellGroup = { is: { churchId } };
    else if (user.churchId) where.cellGroup = { is: { churchId: user.churchId } };

    const meetings = await prisma.cellMeeting.findMany({
      where,
      include: { cellGroup: { select: { id: true, name: true, churchId: true } } },
      orderBy: { meetingDate: "desc" },
      take: 200,
    });
    return NextResponse.json(serializeBigInts(meetings));
  });
}
