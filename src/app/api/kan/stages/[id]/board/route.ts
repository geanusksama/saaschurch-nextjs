import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const stageId = Number(id);

    const stage = await prisma.kanStage.findUnique({
      where: { id: stageId },
      include: { columns: { orderBy: { columnIndex: "asc" } }, service: true, pipeline: true },
    });
    if (!stage) return NextResponse.json({ stage: null, columns: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Record: kanScopeFilter retorna uma uniao em que nem todo ramo tem
    // churchId, e aqui so precisamos saber se ele veio.
    const scope = kanScopeFilter(user) as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardWhere: Record<string, any> = { stageId, deletedAt: null, ...scope };
    const churchId = searchParams.get("churchId");
    // Lista separada por virgula, para o filtro de multiplas igrejas da tela.
    // `churchId` (uma so) continua aceito — outros chamadores ainda usam.
    const churchIds = (searchParams.get("churchIds") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const campoId = searchParams.get("campoId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q");

    // O filtro da tela so pode RESTRINGIR dentro do escopo, nunca substitui-lo.
    // Antes `cardWhere.churchId = churchId` sobrescrevia o churchId que
    // kanScopeFilter tinha fixado, entao um perfil preso a uma igreja (church,
    // secretaria, tesouraria) via cards de qualquer outra so passando o id na
    // query. Com selecao multipla o vazamento seria de varias de uma vez.
    const scopedChurchId = typeof scope.churchId === "string" ? scope.churchId : null;
    const requestedChurchIds = churchIds.length ? churchIds : (churchId ? [churchId] : []);

    if (scopedChurchId) {
      cardWhere.churchId = scopedChurchId;
    } else if (requestedChurchIds.length === 1) {
      cardWhere.churchId = requestedChurchIds[0];
    } else if (requestedChurchIds.length > 1) {
      cardWhere.churchId = { in: requestedChurchIds };
    }
    if (campoId) cardWhere.church = { ...(cardWhere.church || {}), regional: { campoId } };
    if (from || to) {
      cardWhere.openedAt = {};
      if (from) cardWhere.openedAt.gte = new Date(from);
      if (to) { const toDate = new Date(to); toDate.setHours(23, 59, 59, 999); cardWhere.openedAt.lte = toDate; }
    }
    if (q) {
      cardWhere.OR = [
        { protocol: { contains: q, mode: "insensitive" } },
        { candidateName: { contains: q, mode: "insensitive" } },
      ];
    }

    // Exclude cards for PF and PJ members
    cardWhere.AND = [
      {
        OR: [
          { memberId: null },
          {
            member: {
              OR: [
                { memberType: null },
                { memberType: { notIn: ["PF", "PJ", "pf", "pj"] } }
              ]
            }
          }
        ]
      }
    ];

    const cards = await prisma.kanCard.findMany({
      where: cardWhere,
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, rol: true, memberType: true } },
        service: { select: { sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const grouped = stage.columns.map((col) => ({
      ...col,
      cards: cards.filter((c) => c.columnIndex === col.columnIndex),
    }));

    return NextResponse.json(serializeBigInts({ stage, columns: grouped, totalCards: cards.length }));
  });
}
