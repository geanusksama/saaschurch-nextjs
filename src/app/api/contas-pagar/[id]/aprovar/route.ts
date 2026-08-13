import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess, serializeBigInts } from "@/lib/helpers";
import { podeAprovar } from "@/lib/contasPagarScope";

/**
 * POST /api/contas-pagar/[id]/aprovar
 * body: { aprovado: boolean, motivo?: string }
 *
 * Fluxo de alçada: conta acima do limite configurado nasce AGUARDANDO e só
 * libera pagamento depois de aprovada pela tesouraria.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    if (!podeAprovar(user)) {
      return NextResponse.json({ error: "Sem permissão para aprovar contas." }, { status: 403 });
    }

    const conta = await prisma.contaPagar.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, churchId: true, statusAprovacao: true },
    });
    if (!conta) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    if (!(await assertChurchAccess(user, conta.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }
    if (conta.statusAprovacao === "NAO_REQUER") {
      return NextResponse.json({ error: "Esta conta não exige aprovação." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const aprovado = body.aprovado !== false;
    if (!aprovado && !String(body.motivo ?? "").trim()) {
      return NextResponse.json({ error: "Informe o motivo da reprovação." }, { status: 400 });
    }

    const atualizada = await prisma.contaPagar.update({
      where: { id },
      data: {
        statusAprovacao: aprovado ? "APROVADO" : "REPROVADO",
        aprovadoPor: user.id,
        dataAprovacao: new Date(),
        motivoReprovacao: aprovado ? null : String(body.motivo).trim(),
      },
      select: { id: true, numero: true, statusAprovacao: true, dataAprovacao: true, motivoReprovacao: true },
    });

    return NextResponse.json(serializeBigInts(atualizada));
  });
}
