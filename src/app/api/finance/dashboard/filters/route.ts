import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { regionalId } = body;

    // Build scope constraints
    const churchWhere: Record<string, unknown> = { deletedAt: null };
    if (user?.churchId && user?.profileType === "church") {
      // Church users see only their own church - no multi-select needed
      churchWhere.id = user.churchId;
    } else if (user?.campoId) {
      churchWhere.regional = { campo: { id: user.campoId } };
    }
    if (regionalId) {
      churchWhere.regionalId = regionalId;
    }

    const [regionais, churches] = await Promise.all([
      // Only load regionais that have churches in scope
      prisma.regional.findMany({
        where: {
          deletedAt: null,
          ...(user?.campoId ? { campoId: user.campoId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      prisma.church.findMany({
        where: churchWhere,
        select: { id: true, name: true, regionalId: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ]);

    return NextResponse.json({ regionais, churches });
  });
}
