import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, isRestrictedToOwnChurch, roleClassOf, isAtHeadquartersChurch, isFieldAdmin } from "@/lib/helpers";

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
  return {
    ...payload,
    title: fixPossiblyMojibake(payload.title),
    message: fixPossiblyMojibake(payload.message),
    actionText: fixPossiblyMojibake(payload.actionText),
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
    `SELECT n.id::text AS id
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     LEFT JOIN churches c ON c.id = u.church_id
     LEFT JOIN regionais r ON r.id = c.regional_id
     WHERE COALESCE(u.campo_id, r.campo_id)::text = $1
       AND n.data->>'batchId' = $2`,
    campoId, batchId
  );
  return rows.map((r) => r.id).filter(Boolean);
}

async function listFieldRecipientIds(campoId: string) {
  if (!campoId) return [];
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT DISTINCT u.id::text AS id
     FROM users u
     LEFT JOIN churches c ON c.id = u.church_id
     LEFT JOIN regionais r ON r.id = c.regional_id
     WHERE u.deleted_at IS NULL
       AND u.is_active = TRUE
       AND COALESCE(u.campo_id, r.campo_id)::text = $1`,
    campoId
  );
  return rows.map((r) => r.id).filter(Boolean);
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const userId = (user.profile as Record<string, unknown>)?.id as string | undefined;
    if (!userId) return NextResponse.json([]);

    // Filtro de campo: todos os usuários com campoId veem broadcasts do seu campo
    const campoFilter = user.campoId ? {
      AND: [
        { data: { path: ["scope"], equals: "field" } },
        { data: { path: ["campoId"], equals: user.campoId } },
      ],
    } : null;

    let where: Record<string, unknown> = {};
    if (user.profileType === "master") {
      where = {}; // master vê tudo; deduplicação por batchId aplicada abaixo
    } else if (user.profileType === "church") {
      // Perfil church vê apenas broadcasts manuais do campo (scope=field)
      // Não recebe notificações de sistema (pipeline, SOLCRED, etc.)
      where = campoFilter ?? { AND: [{ data: { path: ["scope"], equals: "field" } }] };
    } else if (campoFilter) {
      where = { OR: [{ userId }, campoFilter] };
    } else {
      where = { userId };
    }

    // Filter out archived notifications (only show user's own view)
    let notifications: Awaited<ReturnType<typeof prisma.notification.findMany>>;
    try {
      notifications = await prisma.notification.findMany({
        where: { ...(where as Parameters<typeof prisma.notification.findMany>[0]["where"]), archived: false },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    } catch {
      // Fallback: archived column may not exist yet (pending migration)
      notifications = await prisma.notification.findMany({
        where: where as Parameters<typeof prisma.notification.findMany>[0]["where"],
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }

    // Deduplicar por batchId — broadcasts criam apenas 1 registro, mas registros antigos podem ter duplicatas
    const batchSeen = new Map<string, (typeof notifications)[0]>();
    const deduped: (typeof notifications)[0][] = [];
    for (const n of notifications) {
      const meta = normalizeNotificationData((n.data as Record<string, unknown>) || {});
      const bId = meta.batchId as string | null;
      if (!bId) { deduped.push(n); continue; }
      const existing = batchSeen.get(bId);
      if (!existing) {
        batchSeen.set(bId, n);
        deduped.push(n);
      } else if ((n as unknown as Record<string, unknown>).userId === userId && (existing as unknown as Record<string, unknown>).userId !== userId) {
        // Preferir o registro próprio do usuário (tem estado de leitura/arquivo preciso)
        const idx = deduped.indexOf(existing);
        if (idx !== -1) deduped[idx] = n;
        batchSeen.set(bId, n);
      }
    }

    return NextResponse.json(deduped.map((n) => serializeNotification(n as unknown as Record<string, unknown>, user)));
  });
}

async function listChurchRecipientIds(churchId: string) {
  if (!churchId) return [];
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT DISTINCT u.id::text AS id FROM users u WHERE u.deleted_at IS NULL AND u.is_active = TRUE AND u.church_id = $1::uuid`,
    churchId
  );
  return rows.map((r) => r.id).filter(Boolean);
}

function canCreateNotification(user: import("@/lib/auth").AuthUser) {
  return (
    user.profileType === "master" ||
    user.profileType === "campo" ||
    isFieldAdmin(user)
  );
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!canCreateNotification(user)) {
      return NextResponse.json({ error: "Apenas administradores podem criar notificações." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { title, message, notificationType, iconKey, colorKey, actionUrl, actionText, imageUrl, fileUrl, fileName, scope, churchId } = body;
    if (!title || !notificationType) {
      return NextResponse.json({ error: "title e notificationType são obrigatórios." }, { status: 400 });
    }

    const resolvedScope: string = scope || "field"; // "field" | "church"
    // master pode passar campoId no body; outros usam o próprio campoId
    const effectiveCampoId: string | undefined = (body as Record<string, unknown>).campoId as string || user.campoId || undefined;

    const profile = user.profile as Record<string, unknown>;
    const batchId = crypto.randomUUID();
    const metadata = {
      batchId,
      scope: resolvedScope,
      iconKey: iconKey || "bell",
      colorKey: colorKey || "purple",
      campoId: effectiveCampoId || null,
      churchId: resolvedScope === "church" ? (churchId || null) : null,
      createdBy: profile.id,
    };
    // Cria apenas 1 registro por broadcast — a visibilidade é aplicada no GET via filtro de campo/scope
    const created = await prisma.notification.create({
      data: {
        userId: profile.id as string,
        notificationType,
        title,
        message: message || null,
        actionUrl: actionUrl || null,
        actionText: actionText || null,
        imageUrl: imageUrl || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        data: metadata,
      },
    });
    return NextResponse.json(serializeNotification(created as unknown as Record<string, unknown>, user), { status: 201 });
  });
}
