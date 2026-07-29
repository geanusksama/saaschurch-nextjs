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

    const { currentLeaderRoleDate, entryDate, exitDate, foundedAt, isHost, zone, hostChurchId, ...rest } = body;

    const toDateOrNull = (v: unknown) => (v ? new Date(v as string) : null);
    const toDateOrUndefined = (v: unknown) => (v === undefined ? undefined : toDateOrNull(v));
    // O formulário manda string vazia em campo não preenchido; coluna UUID não aceita.
    const toIdOrNull = (v: unknown) => (v === undefined ? undefined : (v ? String(v) : null));

    const host = isHost === undefined ? undefined : Boolean(isHost);
    // Hospedeira não pode estar anexada a outra — bate com o CHECK do banco e
    // evita devolver um 500 cru quando as duas coisas chegam marcadas juntas.
    const nextHostChurchId = host === true ? null : toIdOrNull(hostChurchId);
    if (nextHostChurchId && nextHostChurchId === id) {
      return NextResponse.json({ error: "Uma igreja não pode ser hospedeira dela mesma." }, { status: 400 });
    }

    try {
      const church = await prisma.$transaction(async (tx) => {
        const updated = await tx.church.update({
          where: { id },
          data: {
            ...rest,
            currentLeaderRoleDate: toDateOrUndefined(currentLeaderRoleDate),
            entryDate: toDateOrNull(entryDate),
            exitDate: toDateOrNull(exitDate),
            foundedAt: toDateOrNull(foundedAt),
            ...(host === undefined ? {} : { isHost: host }),
            ...(zone === undefined ? {} : { zone: zone || null }),
            ...(nextHostChurchId === undefined ? {} : { hostChurchId: nextHostChurchId }),
          },
        });
        // Deixou de ser hospedeira: as anexas ficam soltas em vez de apontar
        // para uma igreja que não hospeda mais ninguém.
        if (host === false) {
          await tx.church.updateMany({ where: { hostChurchId: id }, data: { hostChurchId: null } });
        }
        return updated;
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
