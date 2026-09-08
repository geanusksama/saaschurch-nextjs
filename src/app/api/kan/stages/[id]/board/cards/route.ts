import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import {
  BOARD_CARD_INCLUDE,
  BOARD_LOAD_MORE_SIZE,
  BOARD_ORDER_BY,
  buildBoardCardWhere,
} from "../cardFilter";

/** Teto por requisicao, para que um `take` na querystring nao vire o findMany sem limite de novo. */
const MAX_TAKE = 50;

/**
 * Proxima pagina de cards de UMA coluna do board.
 *
 * A tela chama isto quando a rolagem da coluna se aproxima do fim. O filtro sai
 * do mesmo `buildBoardCardWhere` que a rota do board usa — inclusive o recorte
 * de escopo por igreja/campo, que nao pode ser reescrito aqui.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const stageId = Number(id);

    const columnIndex = Number(searchParams.get("columnIndex"));
    if (!Number.isInteger(columnIndex)) {
      return NextResponse.json({ error: "columnIndex invalido" }, { status: 400 });
    }

    const skip = Math.max(0, Number(searchParams.get("skip")) || 0);
    const requested = Number(searchParams.get("take")) || BOARD_LOAD_MORE_SIZE;
    const take = Math.min(Math.max(1, requested), MAX_TAKE);

    const cardWhere = { ...buildBoardCardWhere(user, stageId, searchParams), columnIndex };

    // Pede um card a mais do que vai devolver: se ele existir, ainda ha pagina
    // seguinte. Evita um count() a cada rolagem — e o count nesta tabela varre
    // dezenas de milhares de linhas.
    const rows = await prisma.kanCard.findMany({
      where: cardWhere,
      include: BOARD_CARD_INCLUDE,
      orderBy: BOARD_ORDER_BY,
      skip,
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const cards = hasMore ? rows.slice(0, take) : rows;

    return NextResponse.json(serializeBigInts({ cards, hasMore }));
  });
}
