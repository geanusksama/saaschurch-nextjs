import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch, serializeBigInts } from "@/lib/helpers";
import { assetDataFromBody } from "@/lib/assetService";

async function loadOwnedAsset(id: string, user: Parameters<typeof isRestrictedToOwnChurch>[0]) {
  const asset = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    include: { church: { select: { id: true, name: true, code: true, regionalId: true } } },
  });
  if (!asset) return null;
  if (isRestrictedToOwnChurch(user) && asset.churchId !== user.churchId) return null;
  return asset;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const asset = await loadOwnedAsset(id, user);
    if (!asset) return NextResponse.json({ error: "Bem não encontrado." }, { status: 404 });
    return NextResponse.json(serializeBigInts(asset));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await loadOwnedAsset(id, user);
    if (!existing) return NextResponse.json({ error: "Bem não encontrado." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data = assetDataFromBody({ ...existing, ...body });
    if (!data.name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const updated = await prisma.asset.update({
      where: { id },
      data: {
        ...data,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
      },
    });

    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await loadOwnedAsset(id, user);
    if (!existing) return NextResponse.json({ error: "Bem não encontrado." }, { status: 404 });

    await prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}
