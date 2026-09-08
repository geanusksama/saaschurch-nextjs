import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import {
  BOARD_CARD_INCLUDE,
  BOARD_ORDER_BY,
  BOARD_PAGE_SIZE,
  buildBoardCardWhere,
} from "./cardFilter";

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

    const cardWhere = buildBoardCardWhere(user, stageId, searchParams);

    // Uma consulta POR COLUNA, cada uma limitada a BOARD_PAGE_SIZE, no lugar de
    // um findMany sem limite que trazia a etapa inteira para depois filtrar em
    // JavaScript. Numa etapa real isso chegava a 42 mil cards com todas as
    // colunas (metadata, attachments, justification), derramava gigabytes em
    // disco temporario e levava mais de 1 s. As colunas sao poucas (uma mao
    // cheia) e as consultas vao em paralelo, entao o custo somado e o de uma so.
    const [counts, ...pages] = await Promise.all([
      prisma.kanCard.groupBy({
        by: ["columnIndex"],
        where: cardWhere,
        _count: { _all: true },
      }),
      ...stage.columns.map((col) =>
        prisma.kanCard.findMany({
          where: { ...cardWhere, columnIndex: col.columnIndex },
          include: BOARD_CARD_INCLUDE,
          orderBy: BOARD_ORDER_BY,
          take: BOARD_PAGE_SIZE,
        }),
      ),
    ]);

    const countByIndex = new Map(counts.map((row) => [row.columnIndex, row._count._all]));

    const grouped = stage.columns.map((col, i) => {
      const cards = pages[i];
      // `total` e a contagem no banco; `cards.length` e o que ja veio. O balao
      // da coluna mostra o total, senao toda coluna cheia diria "40".
      const total = countByIndex.get(col.columnIndex) ?? 0;
      return { ...col, cards, totalCards: total, hasMore: cards.length < total };
    });

    // Soma as contagens de todos os columnIndex encontrados, e nao so os das
    // colunas configuradas, para bater com o total que a rota devolvia antes.
    const totalCards = counts.reduce((sum, row) => sum + row._count._all, 0);

    return NextResponse.json(serializeBigInts({ stage, columns: grouped, totalCards }));
  });
}
