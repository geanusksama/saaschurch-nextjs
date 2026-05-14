import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { isRead, isStarred, isDeleted, isImportant } = body;
    const userId = user.id!;

    const recipient = await prisma.inboxRecipient.findFirst({ where: { id, userId } });
    if (!recipient) return NextResponse.json({ error: "Vínculo de mensagem não encontrado" }, { status: 404 });

    const updated = await prisma.inboxRecipient.update({
      where: { id },
      data: {
        isRead: isRead !== undefined ? isRead : recipient.isRead,
        isStarred: isStarred !== undefined ? isStarred : recipient.isStarred,
        isDeleted: isDeleted !== undefined ? isDeleted : recipient.isDeleted,
        isImportant: isImportant !== undefined ? isImportant : recipient.isImportant,
        readAt: isRead === true && !recipient.isRead ? new Date() : recipient.readAt,
        deletedAt: isDeleted === true && !recipient.isDeleted ? new Date() : recipient.deletedAt,
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const userId = user.id!;
    const recipient = await prisma.inboxRecipient.findFirst({ where: { id, userId } });
    if (!recipient) return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
    await prisma.inboxRecipient.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
