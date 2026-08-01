import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assignCellGroupTag, removeCellGroupTag } from "@/lib/cellGroupService";
import { notifyLeaderOfNewContact } from "@/lib/cellGroupNotify";

/**
 * POST /api/cell-groups/[id]/members — anexa uma pessoa ao GF.
 *
 * Body: { source: 'member' | 'import', memberId?, importRowId?, role?, force? }
 *
 * Ninguém participa de dois GFs ao mesmo tempo: se a pessoa já está em outro
 * grupo a rota responde 409 e só troca de grupo com `force: true`, para a
 * transferência ser uma decisão explícita de quem está na tela.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const source = body.source === "import" ? "import" : "member";
    const force = body.force === true;

    const cell = await prisma.cellGroup.findFirst({
      where: { id, deletedAt: null },
      include: { leader: { select: { id: true, fullName: true, mobile: true, phone: true } } },
    });
    if (!cell) return NextResponse.json({ error: "GF não encontrado" }, { status: 404 });

    if (source === "member") {
      const memberId = String(body.memberId ?? "");
      if (!memberId) return NextResponse.json({ error: "memberId é obrigatório" }, { status: 400 });

      const member = await prisma.member.findFirst({
        where: { id: memberId, deletedAt: null },
        select: { id: true, fullName: true, mobile: true, phone: true },
      });
      if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

      const current = await prisma.cellGroupMember.findFirst({
        where: { memberId, isActive: true },
        include: { cellGroup: { select: { id: true, name: true } } },
      });

      if (current && current.cellGroupId === id) {
        return NextResponse.json({ error: "Este membro já está neste GF" }, { status: 409 });
      }
      if (current && !force) {
        return NextResponse.json(
          { error: `Já está no GF "${current.cellGroup.name}"`, currentCellGroup: current.cellGroup },
          { status: 409 }
        );
      }
      if (current) {
        await prisma.cellGroupMember.update({
          where: { id: current.id },
          data: { isActive: false, leftAt: new Date() },
        });
        await removeCellGroupTag(current.cellGroupId, memberId);
      }

      const link = await prisma.cellGroupMember.create({
        data: {
          cellGroupId: id,
          memberId,
          role: String(body.role ?? "member"),
          joinedAt: new Date(),
        },
      });

      await assignCellGroupTag(id, memberId);
      const share = await notifyLeaderOfNewContact({
        cell,
        userId: String(user.id),
        profileType: user.profileType,
        contactName: member.fullName,
        contactPhone: member.mobile || member.phone || "",
        memberId,
        campoId: user.campoId ?? null,
        origin: req.nextUrl.origin,
      });

      return NextResponse.json(serializeBigInts({ ...link, shareToken: share?.token ?? null }), { status: 201 });
    }

    // ── contato de lista importada ────────────────────────────────────────────
    const importRowId = String(body.importRowId ?? "");
    if (!importRowId) return NextResponse.json({ error: "importRowId é obrigatório" }, { status: 400 });

    const { data: row } = await supabaseAdmin
      .from("whatsapp_import_rows")
      .select("id, name, phone, cell_group_id")
      .eq("id", importRowId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Contato importado não encontrado" }, { status: 404 });

    if (row.cell_group_id === id) {
      return NextResponse.json({ error: "Este contato já está neste GF" }, { status: 409 });
    }
    if (row.cell_group_id && !force) {
      const other = await prisma.cellGroup.findUnique({
        where: { id: row.cell_group_id },
        select: { id: true, name: true },
      });
      return NextResponse.json(
        { error: `Já está no GF "${other?.name ?? "outro"}"`, currentCellGroup: other },
        { status: 409 }
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from("whatsapp_import_rows")
      .update({
        cell_group_id: id,
        cell_group_assigned_at: new Date().toISOString(),
        cell_group_assigned_by: String(user.id),
      })
      .eq("id", importRowId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    const share = await notifyLeaderOfNewContact({
      cell,
      userId: String(user.id),
      profileType: user.profileType,
      contactName: row.name ?? "Contato",
      contactPhone: row.phone ?? "",
      importRowId,
      campoId: user.campoId ?? null,
      origin: req.nextUrl.origin,
    });

    return NextResponse.json({ ok: true, shareToken: share?.token ?? null }, { status: 201 });
  });
}

/**
 * DELETE /api/cell-groups/[id]/members — desanexa.
 * Body: { source: 'member' | 'import', memberId?, importRowId? }
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (body.source === "import") {
      const importRowId = String(body.importRowId ?? "");
      if (!importRowId) return NextResponse.json({ error: "importRowId é obrigatório" }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("whatsapp_import_rows")
        .update({ cell_group_id: null, cell_group_assigned_at: null, cell_group_assigned_by: null })
        .eq("id", importRowId)
        .eq("cell_group_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const memberId = String(body.memberId ?? "");
    if (!memberId) return NextResponse.json({ error: "memberId é obrigatório" }, { status: 400 });

    const link = await prisma.cellGroupMember.findFirst({
      where: { cellGroupId: id, memberId, isActive: true },
    });
    if (!link) return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });

    await prisma.cellGroupMember.update({
      where: { id: link.id },
      data: { isActive: false, leftAt: new Date() },
    });
    await removeCellGroupTag(id, memberId);

    return NextResponse.json({ ok: true });
  });
}
