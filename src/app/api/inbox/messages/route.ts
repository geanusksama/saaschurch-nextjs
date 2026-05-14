import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") || "inbox";
    const campoId = searchParams.get("campoId");
    const userId = user.id;

    type MessageWhere = Record<string, unknown>;
    let where: MessageWhere = {};

    if (folder === "sent") {
      where.senderId = userId;
    } else if (folder === "trash") {
      where.recipients = { some: { userId, isDeleted: true } };
    } else if (folder === "starred") {
      where.recipients = { some: { userId, isStarred: true } };
    } else if (folder === "important") {
      where.recipients = { some: { userId, isImportant: true } };
    } else {
      where.recipients = { some: { userId, isDeleted: false, recipientType: { in: ["TO", "CC"] } } };
    }

    if (user.profileType === "master") {
      if (campoId) where.campoId = campoId;
    } else if (user.profileType === "admin") {
      where.campoId = user.campoId;
    }

    const messages = await prisma.inboxMessage.findMany({
      where: where as Parameters<typeof prisma.inboxMessage.findMany>[0]["where"],
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        recipients: folder === "sent"
          ? { select: { id: true, isRead: true, isStarred: true, isImportant: true, recipientType: true, user: { select: { fullName: true, email: true, systemEmail: true } } } }
          : { where: { userId }, select: { id: true, isRead: true, isStarred: true, isImportant: true, recipientType: true, user: { select: { fullName: true, email: true, systemEmail: true } } } },
        _count: { select: { attachments: true } },
      },
    });

    return NextResponse.json(serializeBigInts(messages));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { subject, body: msgBody, to, cc, bcc, targetCampoId, attachments, threadId } = body;
    const currentCampoId = user.campoId;

    const allRecipients = [
      ...(to || []).map((email: string) => ({ email, type: "TO" })),
      ...(cc || []).map((email: string) => ({ email, type: "CC" })),
      ...(bcc || []).map((email: string) => ({ email, type: "BCC" })),
    ];

    const recipientEmails = allRecipients.map((r: { email: string }) => r.email);
    const users = await prisma.user.findMany({
      where: { OR: [{ email: { in: recipientEmails } }, { systemEmail: { in: recipientEmails } }] },
      select: { id: true, email: true, systemEmail: true },
    });

    const message = await prisma.inboxMessage.create({
      data: {
        senderId: user.id!,
        campoId: targetCampoId || currentCampoId || undefined,
        subject,
        body: msgBody,
        threadId: threadId || undefined,
        recipients: {
          create: [
            { userId: user.id!, recipientType: "SENDER", isRead: true },
            ...allRecipients.map((r: { email: string; type: string }) => {
              const targetUser = users.find((u) => u.email === r.email || u.systemEmail === r.email);
              return { userId: targetUser ? targetUser.id : user.id!, recipientType: r.type, isRead: false };
            }),
          ],
        },
        attachments: {
          create: (attachments || []).map((a: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }) => ({
            name: a.fileName, url: a.fileUrl, size: a.fileSize, type: a.mimeType,
          })),
        },
      },
    });

    if (!threadId) {
      await prisma.inboxMessage.update({ where: { id: message.id }, data: { threadId: message.id } });
    }

    return NextResponse.json(serializeBigInts(message), { status: 201 });
  });
}
