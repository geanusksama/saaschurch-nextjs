import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const excluded = ["CONGREGADO", "MEMBRO"];
    const titles = await prisma.ecclesiasticalTitle.findMany({
      where: { isActive: true, sigla: { notIn: excluded } },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(serializeBigInts(titles));
  });
}
