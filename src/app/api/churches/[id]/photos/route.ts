import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const photos = await prisma.legacyChurchPhoto.findMany({
      where: { churchId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(serializeBigInts(photos));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const church = await prisma.church.findFirst({ where: { id: churchId, deletedAt: null } });
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const photos = Array.isArray(body?.photos) ? body.photos : [];
    if (!photos.length) return NextResponse.json({ error: "photos are required" }, { status: 400 });
    const created = await prisma.$transaction(
      photos.map((item: { url: string; name?: string }) =>
        prisma.legacyChurchPhoto.create({ data: { churchId, photoUrl: item.url, fieldName: item.name || church.name } })
      )
    );
    return NextResponse.json(serializeBigInts(created), { status: 201 });
  });
}
