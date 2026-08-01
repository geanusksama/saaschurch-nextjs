import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cellGroupDataFromBody, leaderIdsFromBody, syncCellGroupLeaders } from "@/lib/cellGroupService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const cell = await prisma.cellGroup.findUnique({
      where: { id },
      include: {
        leader: { select: { fullName: true, mobile: true, phone: true } },
        leaders: {
          orderBy: { position: "asc" },
          include: { member: { select: { id: true, fullName: true, mobile: true, phone: true } } },
        },
        members: {
          where: { isActive: true },
          include: { member: { select: { id: true, fullName: true, photoUrl: true, mobile: true } } },
        },
        meetings: { orderBy: { meetingDate: "desc" }, take: 5 },
        tags: true,
      },
    });
    if (!cell) return NextResponse.json({ error: "GF não encontrado" }, { status: 404 });
    return NextResponse.json(serializeBigInts(cell));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = cellGroupDataFromBody(body);
    if (!data.name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const existing = await prisma.cellGroup.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "GF não encontrado" }, { status: 404 });

    const updated = await prisma.cellGroup.update({ where: { id }, data });
    await syncCellGroupLeaders(id, leaderIdsFromBody(body));

    return NextResponse.json(serializeBigInts(updated));
  });
}

/**
 * DELETE /api/cell-groups/[id] — exclui o GF (soft delete).
 *
 * Quem estava no grupo é liberado junto: sem isso a pessoa ficaria presa a um
 * GF que não existe mais e a trava de "um GF por pessoa" barraria o próximo
 * encaminhamento dela.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;

    const existing = await prisma.cellGroup.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "GF não encontrado" }, { status: 404 });

    await prisma.cellGroupMember.updateMany({
      where: { cellGroupId: id, isActive: true },
      data: { isActive: false, leftAt: new Date() },
    });

    await supabaseAdmin
      .from("whatsapp_import_rows")
      .update({ cell_group_id: null, cell_group_assigned_at: null, cell_group_assigned_by: null })
      .eq("cell_group_id", id);

    // A tag do GF cai por cascata (member_tags.cell_group_id), tirando o
    // rótulo do perfil de quem participava.
    await prisma.memberTag.deleteMany({ where: { cellGroupId: id } });

    await prisma.cellGroup.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ ok: true });
  });
}
