import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; hid: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem editar o histórico." }, { status: 403 });
    }
    const { hid } = await params;
    const body = await req.json().catch(() => ({}));
    const { notes } = body;
    const row = await prisma.memberEventHistory.findFirst({ where: { id: hid } });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const updated = await prisma.memberEventHistory.update({ where: { id: hid }, data: { notes: notes ?? row.notes } });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; hid: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem excluir registros do histórico." }, { status: 403 });
    }
    const { hid } = await params;
    const row = await prisma.memberEventHistory.findFirst({ where: { id: hid } });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    await prisma.memberEventHistory.delete({ where: { id: hid } });
    return new NextResponse(null, { status: 204 });
  });
}
