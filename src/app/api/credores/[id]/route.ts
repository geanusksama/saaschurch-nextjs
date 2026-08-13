import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess, serializeBigInts } from "@/lib/helpers";

async function carregar(id: string) {
  return prisma.credor.findFirst({
    where: { id, deletedAt: null },
    include: {
      banco: { select: { id: true, nome: true } },
      member: { select: { id: true, fullName: true, rol: true } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const credor = await carregar(id);
    if (!credor) return NextResponse.json({ error: "Credor não encontrado." }, { status: 404 });
    if (!(await assertChurchAccess(user, credor.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }
    return NextResponse.json(serializeBigInts(credor));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const credor = await carregar(id);
    if (!credor) return NextResponse.json({ error: "Credor não encontrado." }, { status: 404 });
    if (!(await assertChurchAccess(user, credor.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    const campos = [
      "nome", "tipoPessoa", "cpfCnpj", "tipoCredor", "memberId", "bancoId", "bancoNome",
      "agencia", "conta", "tipoConta", "chavePix", "telefone", "email", "observacoes",
    ] as const;
    for (const campo of campos) {
      if (body[campo] !== undefined) data[campo] = body[campo] === "" ? null : body[campo];
    }
    if (body.ativo !== undefined) data.ativo = !!body.ativo;
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    const atualizado = await prisma.credor.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(atualizado));
  });
}

/**
 * DELETE — exclusão lógica. Credor com conta a pagar vinculada não some do
 * sistema: vira inativo, para que o extrato histórico dele continue de pé.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const credor = await prisma.credor.findFirst({ where: { id, deletedAt: null }, select: { id: true, churchId: true } });
    if (!credor) return NextResponse.json({ error: "Credor não encontrado." }, { status: 404 });
    if (!(await assertChurchAccess(user, credor.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const vinculadas = await prisma.contaPagar.count({ where: { credorId: id, deletedAt: null } });
    if (vinculadas > 0) {
      await prisma.credor.update({ where: { id }, data: { ativo: false } });
      return NextResponse.json({
        ok: true,
        inativado: true,
        message: `Este credor tem ${vinculadas} conta(s) a pagar vinculada(s) e foi inativado em vez de excluído.`,
      });
    }

    await prisma.credor.update({ where: { id }, data: { deletedAt: new Date(), ativo: false } });
    return NextResponse.json({ ok: true, inativado: false });
  });
}
