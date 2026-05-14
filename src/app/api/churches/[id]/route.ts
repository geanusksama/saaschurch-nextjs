import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const church = await prisma.church.findFirst({
      where: { id, deletedAt: null },
      include: {
        regional: { include: { campo: true } },
        headquarters: true,
      },
    });
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    return NextResponse.json(serializeBigInts(church));
  } catch (e) {
    return NextResponse.json({ error: "Erro ao buscar igreja." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { currentLeaderRoleDate, entryDate, exitDate, foundedAt, ...rest } = body;
    const church = await prisma.church.update({
      where: { id },
      data: {
        ...rest,
        currentLeaderRoleDate: currentLeaderRoleDate ? new Date(currentLeaderRoleDate) : undefined,
        entryDate: entryDate ? new Date(entryDate) : undefined,
        exitDate: exitDate ? new Date(exitDate) : undefined,
        foundedAt: foundedAt ? new Date(foundedAt) : undefined,
      },
    });
    return NextResponse.json(serializeBigInts(church));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    await prisma.church.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  });
}
