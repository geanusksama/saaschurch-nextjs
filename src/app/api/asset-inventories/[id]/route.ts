import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch, serializeBigInts } from "@/lib/helpers";

async function loadOwnedInventory(id: string, user: Parameters<typeof isRestrictedToOwnChurch>[0]) {
  const inventory = await prisma.assetInventory.findUnique({
    where: { id },
    include: { church: { select: { id: true, name: true, code: true } } },
  });
  if (!inventory) return null;
  if (isRestrictedToOwnChurch(user) && inventory.churchId !== user.churchId) return null;
  return inventory;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const inventory = await loadOwnedInventory(id, user);
    if (!inventory) return NextResponse.json({ error: "Inventário não encontrado." }, { status: 404 });

    const [items, allAssets] = await Promise.all([
      prisma.assetInventoryItem.findMany({
        where: { inventoryId: id },
        include: { asset: true },
        orderBy: { scannedAt: "desc" },
      }),
      prisma.asset.findMany({
        where: { churchId: inventory.churchId, deletedAt: null, status: "active" },
        select: { id: true, code: true, name: true, sector: true, locationType: true, locationDetail: true },
      }),
    ]);

    const foundIds = new Set(items.map((i) => i.assetId));
    const missing = allAssets.filter((a) => !foundIds.has(a.id));

    return NextResponse.json(serializeBigInts({
      inventory,
      items,
      missing,
      totals: { expected: allAssets.length, found: items.length, missing: missing.length, divergent: items.filter((i) => !i.locationMatch).length },
    }));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const inventory = await loadOwnedInventory(id, user);
    if (!inventory) return NextResponse.json({ error: "Inventário não encontrado." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const updated = await prisma.assetInventory.update({
      where: { id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        observation: body.observation ? String(body.observation).trim() : inventory.observation,
      },
    });

    return NextResponse.json(serializeBigInts(updated));
  });
}
