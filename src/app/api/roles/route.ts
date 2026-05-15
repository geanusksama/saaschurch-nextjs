import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get("churchId");
    const fieldId = searchParams.get("fieldId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };

    if (user.profileType !== "master" && user.churchId) {
      where.OR = [{ churchId: null }, { churchId: user.churchId }];
    }
    if (churchId) where.churchId = churchId;

    // When filtering by campo, restrict to global roles + roles scoped to churches
    // that belong to the selected campo (via regional).
    if (fieldId && !churchId) {
      const churchesInField = await prisma.church.findMany({
        where: { regional: { campoId: fieldId }, deletedAt: null },
        select: { id: true },
      });
      const churchIds = churchesInField.map((c) => c.id);
      where.OR = [{ churchId: null }, { churchId: { in: churchIds } }];
    }

    // Effective campo for counting users: prefer explicit fieldId, then the user's own campo
    const countCampoId = fieldId || user.campoId || null;

    const roles = await prisma.role.findMany({
      where: where as Parameters<typeof prisma.role.findMany>[0]["where"],
      include: {
        _count: {
          select: {
            users: countCampoId
              ? { where: { campoId: countCampoId, deletedAt: null } }
              : true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(roles));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { name, description, churchId, color, permissions, isSystem } = body;
    if (!name) return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        churchId: churchId || null,
        color: color || null,
        permissions: permissions || null,
        isSystem: Boolean(isSystem),
      },
    });
    return NextResponse.json(serializeBigInts(role), { status: 201 });
  });
}
