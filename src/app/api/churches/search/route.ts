import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || searchParams.get("query") || "";
    const campoId = searchParams.get("campoId") || searchParams.get("fieldId");
    const regionalId = searchParams.get("regionalId");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 200);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };
    if (!includeInactive) where.status = { not: "inactive" };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { legalName: { contains: q, mode: "insensitive" } },
        { addressCity: { contains: q, mode: "insensitive" } },
        { regional: { is: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }
    if (user.profileType === "church" && user.churchId) {
      where.id = user.churchId;
    } else {
      if (regionalId) where.regionalId = regionalId;
      const scopedCampoId = ["master", "admin"].includes(user.profileType) ? campoId : (user.campoId || campoId);
      if (scopedCampoId) where.regional = { ...(where.regional || {}), is: { campoId: scopedCampoId } };
    }

    const churches = await prisma.church.findMany({
      where: where as Parameters<typeof prisma.church.findMany>[0]["where"],
      select: {
        id: true,
        name: true,
        code: true,
        legalName: true,
        addressCity: true,
        addressState: true,
        regionalId: true,
        parentChurchId: true,
        regional: { select: { id: true, name: true, campoId: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
    });
    return NextResponse.json(serializeBigInts(churches));
  });
}
