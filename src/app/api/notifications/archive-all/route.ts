import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// PATCH /api/notifications/archive-all — archive all notifications for the current user (hide from view)
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (user) => {
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ archived: 0 });
    const result = await prisma.notification.updateMany({
      where: { userId, archived: false },
      data: { archived: true, archivedAt: new Date() },
    });
    return NextResponse.json({ archived: result.count });
  });
}
