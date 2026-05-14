import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const titles = await prisma.ecclesiasticalTitle.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { level: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(serializeBigInts(titles));
  });
}
