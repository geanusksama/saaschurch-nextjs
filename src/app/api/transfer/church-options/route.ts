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
    const excludeChurchId = searchParams.get("excludeChurchId");
    const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);
    // Campo ativo para todo perfil (lib/campoAtivo.ts).
    const scopedCampoId = user.campoId || (user.profileType === "master" ? campoId || "" : "00000000-0000-0000-0000-000000000000");

    const churches = await prisma.church.findMany({
      where: {
        deletedAt: null,
        ...(excludeChurchId ? { id: { not: excludeChurchId } } : {}),
        ...(regionalId ? { regionalId } : {}),
        ...(scopedCampoId ? { regional: { is: { campoId: scopedCampoId } } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { addressCity: { contains: q, mode: "insensitive" } },
                { regional: { is: { name: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        addressCity: true,
        regionalId: true,
        regional: { select: { id: true, name: true, campoId: true } },
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(churches));
  });
}
