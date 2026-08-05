import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch, serializeBigInts } from "@/lib/helpers";
import { assetDataFromBody, nextAssetCode } from "@/lib/assetService";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;

    const churchId = sp.get("churchId") ?? undefined;
    const regionalId = sp.get("regionalId") ?? undefined;
    const campoId = sp.get("campoId") ?? undefined;
    const sector = sp.get("sector") ?? undefined;
    const category = sp.get("category") ?? undefined;
    const status = sp.get("status") ?? undefined;
    const q = (sp.get("q") ?? sp.get("search") ?? "").trim();
    const dateFrom = sp.get("dateFrom") ?? undefined;
    const dateTo = sp.get("dateTo") ?? undefined;

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 20), 5000);

    // Church scope filter — mesmo padrão de /api/members
    const churchWhere: Record<string, unknown> = { deletedAt: null };
    if (churchId) {
      churchWhere.id = churchId;
    } else if (regionalId) {
      churchWhere.regionalId = regionalId;
    } else if (campoId) {
      churchWhere.regional = { campoId };
    } else if (user.campoId) {
      churchWhere.regional = { campoId: user.campoId };
    }

    if (user.profileType !== "master") {
      if (!user.campoId) {
        return NextResponse.json({ error: "Sem acesso. Campo não definido." }, { status: 403 });
      }
      churchWhere.regional = { ...(churchWhere.regional as Record<string, unknown> || {}), campoId: user.campoId };
    }

    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
      churchWhere.id = user.churchId;
    }

    const where: Record<string, unknown> = { deletedAt: null, church: churchWhere };
    if (sector) where.sector = { in: sector.split(",").filter(Boolean), mode: "insensitive" };
    if (category) where.category = { in: category.split(",").filter(Boolean), mode: "insensitive" };
    if (status) where.status = { in: status.split(",").filter(Boolean) };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.createdAt = dateFilter;
    }

    const skip = (page - 1) * pageSize;
    const include = {
      church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true, campoId: true } } } },
    } as const;

    const [data, total] = await Promise.all([
      prisma.asset.findMany({ where, include, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json(serializeBigInts({ data, total }));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const data = assetDataFromBody(body);
    if (!data.name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const churchId = (body.churchId as string | undefined) || user.churchId || undefined;
    if (!churchId) return NextResponse.json({ error: "Igreja é obrigatória" }, { status: 400 });
    if (isRestrictedToOwnChurch(user) && churchId !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    const code = await nextAssetCode();
    const asset = await prisma.asset.create({
      data: {
        ...data,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
        churchId,
        code,
      },
    });

    return NextResponse.json(serializeBigInts(asset), { status: 201 });
  });
}
