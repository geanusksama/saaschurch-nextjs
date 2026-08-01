import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cellGroupDataFromBody, ensureCellGroupTag, assignCellGroupTag } from "@/lib/cellGroupService";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get("churchId");
    const scopeChurchId = churchId || user.churchId;
    const where = { deletedAt: null, ...(scopeChurchId ? { churchId: scopeChurchId } : {}) };
    const cells = await prisma.cellGroup.findMany({
      where,
      include: {
        leader: { select: { fullName: true, mobile: true, phone: true } },
        _count: { select: { members: { where: { isActive: true } } } },
      },
      orderBy: { name: "asc" },
    });

    // Contato de lista importada também é gente do GF, mas mora no Supabase —
    // sem isso a lista mostra "0 membros" num grupo que tem gente dentro.
    const importCounts = new Map<string, number>();
    if (cells.length) {
      const { data } = await supabaseAdmin
        .from("whatsapp_import_rows")
        .select("cell_group_id")
        .in("cell_group_id", cells.map((c) => c.id));
      for (const row of data ?? []) {
        importCounts.set(row.cell_group_id, (importCounts.get(row.cell_group_id) ?? 0) + 1);
      }
    }

    const withCounts = cells.map((c) => ({
      ...c,
      importContactsCount: importCounts.get(c.id) ?? 0,
      peopleCount: c._count.members + (importCounts.get(c.id) ?? 0),
    }));

    return NextResponse.json(serializeBigInts(withCounts));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const data = cellGroupDataFromBody(body);
    if (!data.name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const churchId = body.churchId || user.churchId;
    if (!churchId) return NextResponse.json({ error: "Igreja é obrigatória" }, { status: 400 });

    const newCell = await prisma.cellGroup.create({ data: { ...data, churchId } });

    await ensureCellGroupTag(newCell.id);
    if (newCell.leaderId) await assignCellGroupTag(newCell.id, newCell.leaderId);

    return NextResponse.json(serializeBigInts(newCell), { status: 201 });
  });
}
