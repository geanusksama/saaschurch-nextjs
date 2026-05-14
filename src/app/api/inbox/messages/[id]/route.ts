import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const message = await prisma.inboxMessage.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        recipients: { select: { id: true, userId: true, recipientType: true, isRead: true, user: { select: { fullName: true, email: true } } } },
        attachments: true,
      },
    });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const isSender = message.senderId === user.id;
    const isRecipient = message.recipients.some((r) => r.userId === user.id);
    const isMaster = user.profileType === "master";
    const isAdminInCampo = user.profileType === "admin" && message.campoId === user.campoId;

    if (!isSender && !isRecipient && !isMaster && !isAdminInCampo) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(serializeBigInts(message));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const message = await prisma.inboxMessage.findUnique({ where: { id } });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (message.senderId !== user.id) {
      return NextResponse.json({ error: "Only the sender can delete sent messages" }, { status: 403 });
    }
    await prisma.inboxMessage.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
