import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    // Accept both `campoId` (app convention) and the legacy `fieldId` alias.
    const campoId = searchParams.get("campoId") || searchParams.get("fieldId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    // Master may target any field; everyone else is scoped to their own.
    // Fall back to the user's own field so a master without an explicit
    // selection never accidentally receives every headquarters.
    const effectiveCampoId =
      user.profileType === "master" ? campoId || user.campoId : user.campoId;
    if (effectiveCampoId) where.fieldId = effectiveCampoId;
    const hqs = await prisma.legacyChurchHeadquarters.findMany({
      where: where as Parameters<typeof prisma.legacyChurchHeadquarters.findMany>[0]["where"],
      orderBy: [{ show: "desc" }, { churchName: "asc" }],
    });
    return NextResponse.json(serializeBigInts(hqs));
  });
}
