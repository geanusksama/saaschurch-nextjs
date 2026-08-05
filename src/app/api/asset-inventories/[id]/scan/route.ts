import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch, serializeBigInts } from "@/lib/helpers";
import { locationLabel, normalizeQrToken } from "@/lib/assetService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const inventory = await prisma.assetInventory.findUnique({ where: { id } });
    if (!inventory) return NextResponse.json({ error: "Inventário não encontrado." }, { status: 404 });
    if (isRestrictedToOwnChurch(user) && inventory.churchId !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso a este inventário." }, { status: 403 });
    }
    if (inventory.status !== "in_progress") {
      return NextResponse.json({ error: "Este inventário já foi finalizado." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = String(body.code || "").trim();
    const locationFound = body.locationFound ? String(body.locationFound).trim() : null;
    const observation = body.observation ? String(body.observation).trim() : null;

    if (!rawCode) return NextResponse.json({ error: "Código não informado." }, { status: 400 });
    const qrToken = normalizeQrToken(rawCode);
    if (!qrToken) return NextResponse.json({ error: "Código inválido." }, { status: 400 });

    const asset = await prisma.asset.findFirst({
      where: { qrToken, churchId: inventory.churchId, deletedAt: null },
    });
    if (!asset) {
      return NextResponse.json({ error: "Este bem não pertence ao inventário desta igreja ou não foi encontrado." }, { status: 404 });
    }

    const locationMatch = locationFound ? false : true;

    const item = await prisma.assetInventoryItem.upsert({
      where: { inventoryId_assetId: { inventoryId: id, assetId: asset.id } },
      create: { inventoryId: id, assetId: asset.id, locationMatch, locationFound, observation },
      update: { locationMatch, locationFound, observation, scannedAt: new Date() },
      include: { asset: true },
    });

    return NextResponse.json(serializeBigInts({
      item,
      registeredLocationLabel: locationLabel(asset.locationType, asset.locationDetail),
    }));
  });
}
