import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: { name?: string; color?: string } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Nome da tag é obrigatório" }, { status: 400 });
      data.name = name;
    }
    if (body.color !== undefined) data.color = String(body.color).trim();

    const tag = await prisma.memberTag.update({ where: { id }, data });
    return NextResponse.json(tag);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    await prisma.memberTag.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
