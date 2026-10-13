import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { itemDaSedeNoCampoAtivo } from "@/lib/campoAtivo";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ scheduleId: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { scheduleId } = await params;
    if (!(await itemDaSedeNoCampoAtivo(user, "horario", scheduleId))) {
      return NextResponse.json({ error: "Item de outro campo." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { dayOfWeek, name, time, icon, order } = body;
    const data: Record<string, unknown> = {};
    if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek;
    if (name !== undefined) data.name = name;
    if (time !== undefined) data.time = time;
    if (icon !== undefined) data.icon = icon;
    if (order !== undefined) data.order = Number(order);
    const updated = await prisma.churchSchedule.update({ where: { id: scheduleId }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ scheduleId: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { scheduleId } = await params;
    if (!(await itemDaSedeNoCampoAtivo(user, "horario", scheduleId))) {
      return NextResponse.json({ error: "Item de outro campo." }, { status: 403 });
    }
    await prisma.churchSchedule.delete({ where: { id: scheduleId } });
    return new NextResponse(null, { status: 204 });
  });
}
