import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const items = await prisma.churchAccessInfo.findMany({
      where: { headquartersId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(serializeBigInts(items));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { type = "bus", description, mapUrl, icon = "Bus", order = 0 } = body;
    if (!description) return NextResponse.json({ error: "description é obrigatório." }, { status: 400 });
    const item = await prisma.churchAccessInfo.create({
      data: { headquartersId: id, type, description, mapUrl: mapUrl || null, icon, order: Number(order) },
    });
    return NextResponse.json(serializeBigInts(item), { status: 201 });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { type, description, mapUrl, icon, order } = body;
    const data: Record<string, unknown> = {};
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description;
    if (mapUrl !== undefined) data.mapUrl = mapUrl || null;
    if (icon !== undefined) data.icon = icon;
    if (order !== undefined) data.order = Number(order);
    const updated = await prisma.churchAccessInfo.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    await prisma.churchAccessInfo.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
