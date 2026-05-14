import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const schedules = await prisma.churchSchedule.findMany({
      where: { headquartersId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(serializeBigInts(schedules));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { dayOfWeek, name, time, icon = "Sun", order = 0 } = body;
    if (!dayOfWeek || !name || !time) return NextResponse.json({ error: "dayOfWeek, name e time são obrigatórios." }, { status: 400 });
    const item = await prisma.churchSchedule.create({
      data: { headquartersId: id, dayOfWeek, name, time, icon, order: Number(order) },
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
    const { dayOfWeek, name, time, icon, order } = body;
    const data: Record<string, unknown> = {};
    if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek;
    if (name !== undefined) data.name = name;
    if (time !== undefined) data.time = time;
    if (icon !== undefined) data.icon = icon;
    if (order !== undefined) data.order = Number(order);
    const updated = await prisma.churchSchedule.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    await prisma.churchSchedule.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  });
}
