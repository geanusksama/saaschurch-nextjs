import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const VALID_STATUS = ["separando", "separado", "entregue", "cancelado"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status } = body;
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    const entrega = await prisma.ebdEntrega.findUnique({
      where: { id, deletedAt: null },
      include: { church: { select: { name: true } } },
    });
    if (!entrega) return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });

    const updated = await prisma.ebdEntrega.update({
      where: { id },
      data: { status },
    });

    if (status === "entregue" || status === "cancelado") {
      await prisma.ebdHistorico.create({
        data: {
          campoId: entrega.campoId,
          churchId: entrega.churchId,
          tipo: status === "cancelado" ? "cancelamento" : "entrega",
          titulo: `${updated.numeroDoc} — ${status === "entregue" ? "Entregue" : "Cancelado"}`,
          descricao: `Igreja: ${entrega.church?.name ?? ""}`,
          valor: entrega.valorTotal,
          referenciaId: entrega.id,
          data: new Date(),
          createdBy: user.id ?? undefined,
        },
      });
    }

    return NextResponse.json(updated);
  });
}
