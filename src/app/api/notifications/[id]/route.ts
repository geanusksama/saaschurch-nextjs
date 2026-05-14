import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, isFieldAdmin } from "@/lib/helpers";

function normalizeNotificationData(data: Record<string, unknown> = {}) {
  return {
    batchId: data?.batchId || null,
    scope: data?.scope || "user",
    iconKey: data?.iconKey || "bell",
    colorKey: data?.colorKey || "purple",
    campoId: data?.campoId || null,
    createdBy: data?.createdBy || null,
  };
}

function serializeNotification(notification: Record<string, unknown>, user: import("@/lib/auth").AuthUser) {
  const payload = serializeBigInts(notification) as Record<string, unknown>;
  const metadata = normalizeNotificationData((payload.data as Record<string, unknown>) || {});
  return {
    ...payload,
    iconKey: metadata.iconKey,
    colorKey: metadata.colorKey,
    batchId: metadata.batchId,
    scope: metadata.scope,
    canManage: isFieldAdmin(user) && metadata.scope === "field" && metadata.campoId === user.campoId,
  };
}

async function listFieldNotificationIds(campoId: string, batchId: string) {
  if (!campoId || !batchId) return [];
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT n.id::text AS id FROM notifications n JOIN users u ON u.id = n.user_id
     LEFT JOIN churches c ON c.id = u.church_id LEFT JOIN regionais r ON r.id = c.regional_id
     WHERE COALESCE(u.campo_id, r.campo_id)::text = $1 AND n.data->>'batchId' = $2`,
    campoId, batchId
  );
  return rows.map((r) => r.id).filter(Boolean);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 401 });

    const current = await prisma.notification.findFirst({ where: { id, userId } });
    if (!current) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });

    const metadata = normalizeNotificationData((current.data as Record<string, unknown>) || {});
    const body = await req.json().catch(() => ({}));
    const { read, title, message, notificationType, actionUrl, actionText, iconKey, colorKey } = body;
    const wantsContentUpdate = [title, message, notificationType, actionUrl, actionText, iconKey, colorKey].some((v) => v !== undefined);

    if (wantsContentUpdate) {
      if (!isFieldAdmin(user) || metadata.scope !== "field" || metadata.campoId !== user.campoId || !metadata.batchId) {
        return NextResponse.json({ error: "Apenas o administrador do campo pode editar esta notificação." }, { status: 403 });
      }
      const notificationIds = await listFieldNotificationIds(user.campoId!, metadata.batchId as string);
      if (!notificationIds.length) return NextResponse.json({ error: "Lote de notificações não encontrado." }, { status: 404 });

      await prisma.notification.updateMany({
        where: { id: { in: notificationIds } },
        data: {
          title: title ?? current.title,
          message: message === undefined ? current.message : message,
          notificationType: notificationType ?? current.notificationType,
          actionUrl: actionUrl === undefined ? current.actionUrl : actionUrl,
          actionText: actionText === undefined ? current.actionText : actionText,
          data: { ...(metadata as Record<string, unknown>), iconKey: iconKey || metadata.iconKey, colorKey: colorKey || metadata.colorKey },
        },
      });
      const updated = await prisma.notification.findFirst({ where: { id } });
      return NextResponse.json(serializeNotification((updated || current) as unknown as Record<string, unknown>, user));
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: Boolean(read), readAt: read ? new Date() : null },
    });
    return NextResponse.json(serializeNotification(updated as unknown as Record<string, unknown>, user));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 401 });

    const current = await prisma.notification.findFirst({ where: { id, userId } });
    if (!current) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });

    const metadata = normalizeNotificationData((current.data as Record<string, unknown>) || {});
    if (isFieldAdmin(user) && metadata.scope === "field" && metadata.campoId === user.campoId && metadata.batchId) {
      const notificationIds = await listFieldNotificationIds(user.campoId!, metadata.batchId as string);
      if (notificationIds.length) {
        await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
        return new NextResponse(null, { status: 204 });
      }
    }
    await prisma.notification.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
