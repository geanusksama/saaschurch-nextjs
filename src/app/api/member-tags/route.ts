import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get("churchId") || user.churchId;
    if (!churchId) return NextResponse.json([]);

    const tags = await prisma.memberTag.findMany({
      where: { churchId },
      include: { cellGroup: { select: { id: true, name: true } }, _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(tags);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const color = String(body.color ?? "#8b5cf6").trim();
    const churchId = body.churchId || user.churchId;

    if (!name) return NextResponse.json({ error: "Nome da tag é obrigatório" }, { status: 400 });
    if (!churchId) return NextResponse.json({ error: "Igreja é obrigatória" }, { status: 400 });

    const duplicate = await prisma.memberTag.findUnique({ where: { churchId_name: { churchId, name } } });
    if (duplicate) return NextResponse.json({ error: "Já existe uma tag com esse nome" }, { status: 409 });

    const tag = await prisma.memberTag.create({
      data: { churchId, name, color, cellGroupId: body.cellGroupId || null },
    });
    return NextResponse.json(tag, { status: 201 });
  });
}
