import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  return withAuth(req, async (user) => {
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ updated: 0 });
    const now = new Date();
    // Marca os registros próprios do usuário como lidos
    const own = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: now },
    });
    // Também marca broadcasts do campo como lidos
    let campo = { count: 0 };
    if (user.campoId) {
      campo = await prisma.notification.updateMany({
        where: {
          read: false,
          AND: [
            { data: { path: ["scope"], equals: "field" } },
            { data: { path: ["campoId"], equals: user.campoId } },
          ],
        },
        data: { read: true, readAt: now },
      });
    }
    return NextResponse.json({ updated: own.count + campo.count });
  });
}
