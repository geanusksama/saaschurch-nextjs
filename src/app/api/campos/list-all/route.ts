import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { deletedAt: null };
      if (user.profileType !== "master") {
        if (!user.campoId) {
          return NextResponse.json([]);
        }
        where.id = user.campoId;
      }

      const campos = await prisma.campo.findMany({
        where,
        select: { id: true, name: true, domain: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(serializeBigInts(campos));
    } catch (e) {
      console.error("[GET /api/campos/list-all]", e);
      return NextResponse.json({ error: "Erro ao carregar campos." }, { status: 500 });
    }
  });
}
