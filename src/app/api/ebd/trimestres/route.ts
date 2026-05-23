import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const rows = await prisma.ebdTrimestre.findMany({
      where: { campoId, deletedAt: null },
      orderBy: [{ ano: "desc" }, { dataInicio: "desc" }],
    });
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, nome, ano, dataInicio, dataFim, ativo } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!nome || !ano || !dataInicio || !dataFim) {
      return NextResponse.json({ error: "nome, ano, dataInicio e dataFim são obrigatórios" }, { status: 400 });
    }
    const row = await prisma.ebdTrimestre.create({
      data: {
        campoId,
        nome,
        ano: Number(ano),
        dataInicio: new Date(dataInicio),
        dataFim: new Date(dataFim),
        ativo: ativo !== false,
        createdBy: user.id ?? undefined,
      },
    });
    return NextResponse.json(row, { status: 201 });
  });
}
