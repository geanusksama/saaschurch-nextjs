import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const campoId = searchParams.get("campoId");
    const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);

    const churches = await prisma.church.findMany({
      where: {
        deletedAt: null,
        ...(campoId ? { campoId } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
      },
      select: { id: true, name: true, code: true, campoId: true },
      take: limit,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(churches));
  });
}
