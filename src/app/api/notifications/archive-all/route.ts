import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// PATCH /api/notifications/archive-all — archive all notifications for the current user (hide from view)
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (user) => {
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ archived: 0 });
    const now = new Date();
    // Arquiva os registros próprios do usuário
    const own = await prisma.notification.updateMany({
      where: { userId, archived: false },
      data: { archived: true, archivedAt: now },
    });
    // Também arquiva broadcasts do campo visíveis ao usuário (registros com scope=field do campo)
    let campo = { count: 0 };
    if (user.campoId) {
      campo = await prisma.notification.updateMany({
        where: {
          archived: false,
          AND: [
            { data: { path: ["scope"], equals: "field" } },
            { data: { path: ["campoId"], equals: user.campoId } },
          ],
        },
        data: { archived: true, archivedAt: now },
      });
    }
    return NextResponse.json({ archived: own.count + campo.count });
  });
}
