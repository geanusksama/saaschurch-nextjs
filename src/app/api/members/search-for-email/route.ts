import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    if (!q || q.length < 2) return NextResponse.json([]);

    const where: Record<string, unknown> = {
      deletedAt: null,
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { systemEmail: { contains: q, mode: "insensitive" } },
      ],
    };

    if (user.profileType !== "master") {
      if (user.campoId) {
        where.campoId = user.campoId;
      } else if (user.churchId) {
        where.churchId = user.churchId;
      }
    }

    const users = await prisma.user.findMany({
      where: where as Parameters<typeof prisma.user.findMany>[0]["where"],
      select: { id: true, fullName: true, email: true, systemEmail: true, avatarUrl: true },
      take: 20,
    });

    return NextResponse.json(serializeBigInts(users));
  });
}
