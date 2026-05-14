import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ accessId: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { accessId } = await params;
    const body = await req.json().catch(() => ({}));
    const { type, description, mapUrl, icon, order } = body;
    const data: Record<string, unknown> = {};
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description;
    if (mapUrl !== undefined) data.mapUrl = mapUrl || null;
    if (icon !== undefined) data.icon = icon;
    if (order !== undefined) data.order = Number(order);
    const updated = await prisma.churchAccessInfo.update({ where: { id: accessId }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ accessId: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { accessId } = await params;
    await prisma.churchAccessInfo.delete({ where: { id: accessId } });
    return new NextResponse(null, { status: 204 });
  });
}
