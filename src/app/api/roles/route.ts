import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const campoId = searchParams.get("campoId");
    const churchId = searchParams.get("churchId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };
    if (user.profileType === "master") {
      if (campoId) where.campoId = campoId;
    } else if (user.profileType === "admin") {
      where.campoId = user.campoId;
    } else if (user.campoId) {
      where.campoId = user.campoId;
    }
    if (churchId) where.churchId = churchId;

    const roles = await prisma.role.findMany({
      where: where as Parameters<typeof prisma.role.findMany>[0]["where"],
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
    const { name, description, campoId, churchId, permissions } = body;
    if (!name) return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });

    const effectiveCampoId = user.profileType === "admin" ? user.campoId : (campoId || null);
    const role = await prisma.role.create({
      data: { name, description: description || null, campoId: effectiveCampoId, churchId: churchId || null, permissions: permissions || null },
    });
    return NextResponse.json(serializeBigInts(role), { status: 201 });
  });
}
