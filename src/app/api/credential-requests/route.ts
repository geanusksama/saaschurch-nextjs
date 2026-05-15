import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { serializeBigInts, assertChurchAccess, buildProtocol } from "@/lib/helpers";

function canSeeAll(user: { profileType?: string }) {
  return user.profileType === "master" || user.profileType === "admin" || user.profileType === "campo";
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const situacao = searchParams.get("situacao");
    const churchId = searchParams.get("church_id");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabaseAdmin.from("tbcredencial").select("*").order("created_at", { ascending: false });
    if (situacao) query = (query as ReturnType<typeof supabaseAdmin.from>).eq("situacao", situacao) as typeof query;
    if (churchId) query = (query as ReturnType<typeof supabaseAdmin.from>).eq("church_id", churchId) as typeof query;
    if (!canSeeAll(user) && user.churchId) {
      query = (query as ReturnType<typeof supabaseAdmin.from>).eq("church_id", user.churchId) as typeof query;
    }
    const { data, error } = await query.limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { nome, tipo, numero, idtbmembro, memberId, igrejasolicitante, datavalidade, dataemissao, situacao, obs } = body;
    if (!tipo) return NextResponse.json({ error: "tipo is required" }, { status: 400 });
    const resolvedMemberId = String(memberId || "").trim() || (idtbmembro != null ? String(idtbmembro).trim() : "");
    if (!resolvedMemberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

    const member = await prisma.member.findFirst({
      where: { id: resolvedMemberId, deletedAt: null },
      include: { church: { select: { id: true, name: true, code: true } } },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    // Look up by sigla first (SOLCRED), then fall back to serviceGroup CREDENCIAL
    const service = await prisma.kanService.findFirst({
      where: { isActive: true, OR: [{ sigla: "SOLCRED" }, { serviceGroup: "CREDENCIAL" }] },
    });
    if (!service) return NextResponse.json({ error: "credential service not configured" }, { status: 404 });
    const stage = await prisma.kanStage.findFirst({ where: { serviceId: service.id, isActive: true }, include: { columns: { where: { columnIndex: 1 }, take: 1 } } });
    if (!stage) return NextResponse.json({ error: "credential stage not configured" }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "stage has no first column" }, { status: 400 });

    const churchLabel = igrejasolicitante || (member.church?.code ? `${member.church.code} - ${member.church.name}` : member.church?.name || null);
    const { data: credData, error: credError } = await supabaseAdmin.from("tbcredencial")
      .insert({ nome: nome || member.fullName || null, tipo, numero: numero || null, idtbmembro: Number.isFinite(Number(idtbmembro)) ? Number(idtbmembro) : null, member_id: member.id, church_id: member.churchId, requester_user_id: user.id || null, igrejasolicitante: churchLabel, datavalidade: datavalidade || null, dataemissao: dataemissao || null, situacao: situacao || "Pendente", obs: obs || null })
      .select().single();
    if (credError) return NextResponse.json({ error: credError.message }, { status: 500 });

    const card = await prisma.kanCard.create({
      data: {
        protocol: buildProtocol(service.sigla), stageId: stage.id, serviceId: service.id,
        columnId: firstColumn.id, columnIndex: 1, churchId: member.churchId,
        memberId: member.id, candidateName: member.fullName, status: "pendente",
        statusLabel: firstColumn.name, createdBy: user.id || null,
        metadata: { flowType: "credential", credentialRequestId: credData.id, credentialType: tipo },
      },
    });
    await supabaseAdmin.from("tbcredencial").update({ kan_card_id: card.id, card_protocol: card.protocol }).eq("id", credData.id);

    // Notification (non-fatal)
    try {
      await prisma.notification.create({
        data: {
          userId: user.id!, notificationType: "kan_action",
          title: `Novo registro criado (SOLCRED) \u2014 ${card.protocol}`,
          message: member.fullName || null,
          actionUrl: "/admin/secretaria/pipeline", actionText: "Ver",
          data: { scope: "field", campoId: user.campoId || null, cardId: card.id, action: "created" },
        },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json(serializeBigInts({ ok: true, request: credData, card }), { status: 201 });
  });
}
