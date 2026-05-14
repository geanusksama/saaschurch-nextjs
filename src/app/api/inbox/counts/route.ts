import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const userId = user.id!;
    const [inbox, sent, trash, starred, important] = await Promise.all([
      prisma.inboxRecipient.count({ where: { userId, isDeleted: false, isRead: false, recipientType: { in: ["TO", "CC"] } } }),
      prisma.inboxMessage.count({ where: { senderId: userId } }),
      prisma.inboxRecipient.count({ where: { userId, isDeleted: true } }),
      prisma.inboxRecipient.count({ where: { userId, isStarred: true } }),
      prisma.inboxRecipient.count({ where: { userId, isImportant: true } }),
    ]);
    return NextResponse.json({ inbox, sent, trash, starred, important });
  });
}
