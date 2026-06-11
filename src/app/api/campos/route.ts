import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

function sanitizeCampo(campo: Record<string, unknown>) {
  if (!campo) return campo;
  const { accessPasswordHash, ...safeCampo } = campo;
  void accessPasswordHash;
  return safeCampo;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { deletedAt: null };
      if (user.profileType !== "master") {
        if (!user.campoId) {
          return NextResponse.json([]);
        }
        where.id = user.campoId;
      }

      const campos = await prisma.campo.findMany({
        where,
        orderBy: { name: "asc" },
      });
      return NextResponse.json(campos.map(sanitizeCampo));
    } catch (e) {
      console.error("[GET /api/campos]", e);
      return NextResponse.json({ error: "Erro ao carregar campos." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { name, code, description, logoUrl, country } = body;
    if (!name || !code) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }
    const campo = await prisma.campo.create({
      data: { name, code, description, logoUrl, country },
    });
    return NextResponse.json(sanitizeCampo(campo as Record<string, unknown>), { status: 201 });
  });
}
