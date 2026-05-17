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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const { currentLeaderRoleDate, entryDate, exitDate, foundedAt, ...rest } = body;

    const toDateOrNull = (v: unknown) => (v ? new Date(v as string) : null);
    const toDateOrUndefined = (v: unknown) => (v === undefined ? undefined : toDateOrNull(v));

    try {
      const church = await prisma.church.update({
        where: { id },
        data: {
          ...rest,
          currentLeaderRoleDate: toDateOrUndefined(currentLeaderRoleDate),
          entryDate: toDateOrNull(entryDate),
          exitDate: toDateOrNull(exitDate),
          foundedAt: toDateOrNull(foundedAt),
        },
      });
      return NextResponse.json(serializeBigInts(church));
    } catch (e) {
      console.error("[PATCH /churches/:id]", e);
      return NextResponse.json({ error: "Erro ao atualizar os dados da igreja." }, { status: 500 });
    }
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
