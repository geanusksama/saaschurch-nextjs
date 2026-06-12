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

function fixPossiblyMojibake(value: unknown) {
  if (typeof value !== "string" || !/[ÃÂâ€�â€“â€”]/.test(value)) return value;

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    return repaired.includes("�") ? value : repaired;
  } catch {
    return value;
  }
}

function serializeNotification(notification: Record<string, unknown>, user: import("@/lib/auth").AuthUser) {
  const payload = serializeBigInts(notification) as Record<string, unknown>;
  const metadata = normalizeNotificationData((payload.data as Record<string, unknown>) || {});
  const canManage = user.profileType === "master" ||
    ((user.profileType === "campo" || isFieldAdmin(user)) && metadata.campoId === user.campoId);

  return {
    ...payload,
    title: fixPossiblyMojibake(payload.title),
    message: fixPossiblyMojibake(payload.message),
    actionText: fixPossiblyMojibake(payload.actionText),
    iconKey: metadata.iconKey,
    colorKey: metadata.colorKey,
    batchId: metadata.batchId,
    scope: metadata.scope,
    canManage,
  };
}

async function listNotificationIdsByBatch(batchId: string, campoId?: string | null) {
  if (!batchId) return [];
  const filters: any[] = [
    { data: { path: ["batchId"], equals: batchId } }
  ];
  if (campoId) {
    filters.push({ data: { path: ["campoId"], equals: campoId } });
  }
  const notifications = await prisma.notification.findMany({
    where: { AND: filters },
    select: { id: true }
  });
  return notifications.map((n) => n.id);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 401 });

    // master/admin may operate on any notification; others only on their own
    const isSuperUser = user.profileType === "master" || user.profileType === "campo" || user.profileType === "admin";
    const current = await prisma.notification.findFirst({
      where: isSuperUser ? { id } : { id, userId },
    });
    if (!current) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });

    const metadata = normalizeNotificationData((current.data as Record<string, unknown>) || {});
    const body = await req.json().catch(() => ({}));
    const { read, archived, title, message, notificationType, actionUrl, actionText, iconKey, colorKey } = body;

    // Archive (soft-hide from user's view only)
    if (archived !== undefined && !title && !message && !notificationType && !actionUrl && !actionText && !iconKey && !colorKey && read === undefined) {
      const canManage = user.profileType === "master" ||
        ((user.profileType === "campo" || isFieldAdmin(user)) && metadata.campoId === user.campoId);

      if (canManage && metadata.batchId) {
        const campoFilter = user.profileType === "master" ? null : user.campoId;
        const notificationIds = await listNotificationIdsByBatch(metadata.batchId as string, campoFilter);
        if (notificationIds.length) {
          await prisma.notification.updateMany({
            where: { id: { in: notificationIds } },
            data: { archived: Boolean(archived), archivedAt: archived ? new Date() : null },
          });
          const updated = await prisma.notification.findFirst({ where: { id } });
          return NextResponse.json(serializeNotification((updated || current) as unknown as Record<string, unknown>, user));
        }
      }
      const updated = await prisma.notification.update({
        where: { id },
        data: { archived: Boolean(archived), archivedAt: archived ? new Date() : null },
      });
      return NextResponse.json(serializeNotification(updated as unknown as Record<string, unknown>, user));
    }

    const wantsContentUpdate = [title, message, notificationType, actionUrl, actionText, iconKey, colorKey].some((v) => v !== undefined);

    if (wantsContentUpdate) {
      const canEdit = user.profileType === "master" ||
        ((user.profileType === "campo" || isFieldAdmin(user)) && metadata.campoId === user.campoId);

      if (!canEdit || !metadata.batchId) {
        return NextResponse.json({ error: "Você não tem permissão para editar esta notificação." }, { status: 403 });
      }
      const campoFilter = user.profileType === "master" ? null : user.campoId;
      const notificationIds = await listNotificationIdsByBatch(metadata.batchId as string, campoFilter);
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

    const isSuperUser2 = user.profileType === "master" || user.profileType === "campo" || user.profileType === "admin";
    const current = await prisma.notification.findFirst({
      where: isSuperUser2 ? { id } : { id, userId },
    });
    if (!current) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });

    const metadata = normalizeNotificationData((current.data as Record<string, unknown>) || {});
    const canManage = user.profileType === "master" ||
      ((user.profileType === "campo" || isFieldAdmin(user)) && metadata.campoId === user.campoId);

    if (canManage && metadata.batchId) {
      const campoFilter = user.profileType === "master" ? null : user.campoId;
      const notificationIds = await listNotificationIdsByBatch(metadata.batchId as string, campoFilter);
      if (notificationIds.length) {
        await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
        return new NextResponse(null, { status: 204 });
      }
    }
    await prisma.notification.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
