import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const campoId = searchParams.get("campoId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    const effectiveCampoId = user.profileType === "master" ? campoId : user.campoId;
    if (effectiveCampoId) where.fieldId = effectiveCampoId;
    const hqs = await prisma.legacyChurchHeadquarters.findMany({
      where: where as Parameters<typeof prisma.legacyChurchHeadquarters.findMany>[0]["where"],
      orderBy: [{ show: "desc" }, { churchName: "asc" }],
    });
    return NextResponse.json(serializeBigInts(hqs));
  });
}
