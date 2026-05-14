import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const campoId = searchParams.get("campoId");
    const regionalId = searchParams.get("regionalId");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 200);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };
    if (!includeInactive) where.isActive = true;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { legalName: { contains: q, mode: "insensitive" } },
      ];
    }
    if (regionalId) where.regionalId = regionalId;
    if (campoId) where.regional = { campoId };

    const churches = await prisma.church.findMany({
      where: where as Parameters<typeof prisma.church.findMany>[0]["where"],
      select: { id: true, name: true, code: true, legalName: true, regionalId: true, parentChurchId: true, regional: { select: { id: true, name: true, campoId: true } } },
      orderBy: { name: "asc" },
      take: limit,
    });
    return NextResponse.json(serializeBigInts(churches));
  });
}
