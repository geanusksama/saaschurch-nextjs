import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

const HOSTED_SELECT = {
  id: true,
  name: true,
  code: true,
  zone: true,
  status: true,
  addressCity: true,
  addressState: true,
  currentLeaderName: true,
  leaderRoll: true,
  regional: { select: { id: true, name: true, code: true } },
} as const;

/** Igrejas anexas de uma hospedeira. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const hosted = await prisma.church.findMany({
      where: { hostChurchId: churchId, deletedAt: null },
      select: HOSTED_SELECT,
      orderBy: [{ zone: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(serializeBigInts(hosted));
  });
}

/**
 * Define o conjunto de anexas desta hospedeira.
 *
 * Recebe a lista completa (`churchIds`) e reconcilia: quem saiu perde o
 * vínculo, quem entrou passa a apontar para cá. Enviar a lista inteira, em vez
 * de um "adiciona/remove", evita que duas telas abertas ao mesmo tempo deixem o
 * vínculo pela metade.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const host = await prisma.church.findFirst({
      where: { id: churchId, deletedAt: null },
      select: { id: true, hostChurchId: true },
    });
    if (!host) return NextResponse.json({ error: "church not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const requested: string[] = Array.isArray(body?.churchIds) ? body.churchIds.filter((value: unknown) => typeof value === "string") : [];
    const churchIds = [...new Set(requested)].filter((id) => id !== churchId);

    if (churchIds.length) {
      // Uma hospedeira não pode virar anexa de outra: viraria corrente.
      const invalid = await prisma.church.findFirst({
        where: { id: { in: churchIds }, deletedAt: null, isHost: true },
        select: { id: true, name: true },
      });
      if (invalid) {
        return NextResponse.json(
          { error: `"${invalid.name}" é hospedeira e não pode ser anexada a outra. Desmarque-a como hospedeira primeiro.` },
          { status: 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Marcar como hospedeira é implícito ao ter anexas.
      if (churchIds.length && !host.hostChurchId) {
        await tx.church.update({ where: { id: churchId }, data: { isHost: true, hostChurchId: null } });
      }
      await tx.church.updateMany({
        where: { hostChurchId: churchId, id: { notIn: churchIds.length ? churchIds : ["00000000-0000-0000-0000-000000000000"] } },
        data: { hostChurchId: null },
      });
      if (churchIds.length) {
        await tx.church.updateMany({ where: { id: { in: churchIds }, deletedAt: null }, data: { hostChurchId: churchId } });
      }
      return tx.church.findMany({
        where: { hostChurchId: churchId, deletedAt: null },
        select: HOSTED_SELECT,
        orderBy: [{ zone: "asc" }, { name: "asc" }],
      });
    });

    return NextResponse.json(serializeBigInts(result));
  });
}
