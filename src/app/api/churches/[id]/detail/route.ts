import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const church = await prisma.church.findFirst({
      where: { id, deletedAt: null },
      include: {
        regional: { include: { campo: true } },
        parentChurch: { select: { id: true, name: true, code: true } },
        headquarters: { select: { id: true, churchName: true, fieldId: true, fieldName: true, regionalName: true, city: true, state: true } },
      },
    });
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, church.id, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso a registros de outra igreja." }, { status: 403 });
    return NextResponse.json(serializeBigInts(church));
  });
}
