import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;
    const churchId = sp.get("churchId") ?? undefined;
    const regionalId = sp.get("regionalId") ?? undefined;
    const campoId = sp.get("campoId") ?? undefined;
    const dateFrom = sp.get("dateFrom") ?? undefined;
    const dateTo = sp.get("dateTo") ?? undefined;
    const status = sp.get("status") ?? undefined;

    const churchWhere: Record<string, unknown> = { deletedAt: null };
    if (churchId) churchWhere.id = churchId;
    else if (regionalId) churchWhere.regionalId = regionalId;
    else if (campoId) churchWhere.regional = { campoId };
    else if (user.campoId) churchWhere.regional = { campoId: user.campoId };

    if (user.profileType !== "master") {
      if (!user.campoId) return NextResponse.json({ error: "Sem acesso. Campo não definido." }, { status: 403 });
      churchWhere.regional = { ...(churchWhere.regional as Record<string, unknown> || {}), campoId: user.campoId };
    }
    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
      churchWhere.id = user.churchId;
    }

    const where: Record<string, unknown> = { church: churchWhere };
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.startedAt = dateFilter;
    }

    const inventories = await prisma.assetInventory.findMany({
      where,
      include: {
        church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true } } } },
        startedByUser: { select: { id: true, fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 200,
    });

    return NextResponse.json(serializeBigInts(inventories));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const churchId = (body.churchId as string | undefined) || user.churchId || undefined;
    if (!churchId) return NextResponse.json({ error: "Igreja é obrigatória." }, { status: 400 });
    if (isRestrictedToOwnChurch(user) && churchId !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }
    if (!user.id) return NextResponse.json({ error: "Usuário não identificado." }, { status: 403 });

    const church = await prisma.church.findUnique({
      where: { id: churchId },
      select: { currentLeaderName: true },
    });

    const inventory = await prisma.assetInventory.create({
      data: {
        churchId,
        startedByUserId: user.id,
        leaderName: church?.currentLeaderName || null,
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        startedByUser: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json(serializeBigInts(inventory), { status: 201 });
  });
}
