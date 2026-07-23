import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    // Accept both `campoId` and the `fieldId` alias used by some callers.
    const campoId = searchParams.get("campoId") || searchParams.get("fieldId");
    const churchId = searchParams.get("churchId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };
    if (user.profileType === "master") {
      // Fallback para o campo logado: sem ele a lista vazava regional de outro campo
      const scoped = campoId || user.campoId;
      if (scoped) where.campoId = scoped;
    } else {
      if (!user.campoId) return NextResponse.json([]);
      where.campoId = user.campoId;
    }
    if (churchId) where.churchId = churchId;

    const regionais = await prisma.regional.findMany({
      where: where as Parameters<typeof prisma.regional.findMany>[0]["where"],
      orderBy: { name: "asc" },
      include: { campo: { select: { id: true, name: true } } },
    });
    return NextResponse.json(serializeBigInts(regionais));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { name, code, description, campoId } = body;
    if (!name || !code) return NextResponse.json({ error: "name e code são obrigatórios." }, { status: 400 });
    const effectiveCampoId = user.profileType === "admin" ? (user.campoId || campoId) : campoId;
    if (!effectiveCampoId) return NextResponse.json({ error: "campoId é obrigatório." }, { status: 400 });
    const regional = await prisma.regional.create({
      data: { name, code, description: description || null, campoId: effectiveCampoId },
    });
    return NextResponse.json(serializeBigInts(regional), { status: 201 });
  });
}
