import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// POST /api/notifications/[id]/ack  — register "viewed" or "aware" acknowledgment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ackType: string = body.ackType || "viewed"; // "viewed" | "aware"

    if (!["viewed", "aware"].includes(ackType)) {
      return NextResponse.json({ error: "ackType inválido." }, { status: 400 });
    }

    // Find the notification (could be any in the batch visible to this user)
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });
    }

    const data = (notification.data as Record<string, unknown>) || {};
    const batchId = (data.batchId as string) || null;

    // Upsert: if already exists just return it
    const ack = await prisma.notificationAck.upsert({
      where: {
        notificationId_userId_ackType: {
          notificationId: id,
          userId,
          ackType,
        },
      },
      create: {
        notificationId: id,
        userId,
        batchId,
        ackType,
      },
      update: {}, // keep original timestamp
    });

    // Also mark as read when aware
    if (ackType === "aware" && !notification.read) {
      await prisma.notification.update({
        where: { id },
        data: { read: true, readAt: new Date() },
      });
    }

    return NextResponse.json(ack, { status: 201 });
  });
}

// GET /api/notifications/[id]/ack — return current user's ack status
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({});

    const acks = await prisma.notificationAck.findMany({
      where: { notificationId: id, userId },
    });

    return NextResponse.json({
      viewed: acks.some((a) => a.ackType === "viewed"),
      aware: acks.some((a) => a.ackType === "aware"),
    });
  });
}
