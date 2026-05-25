import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const situacao  = searchParams.get("situacao");
    const campoId   = searchParams.get("campo_id");
    const regionalId = searchParams.get("regional_id");
    const churchId  = searchParams.get("church_id");
    const from      = searchParams.get("from");
    const to        = searchParams.get("to");

    const canSeeAll = user.profileType === "master" || user.profileType === "admin" || user.profileType === "campo";

    // ── 1. Busca credenciais ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabaseAdmin.from("tbcredencial").select("*").order("created_at", { ascending: false });
    if (situacao)  query = (query as ReturnType<typeof supabaseAdmin.from>).eq("situacao", situacao) as typeof query;
    if (churchId)  query = (query as ReturnType<typeof supabaseAdmin.from>).eq("church_id", churchId) as typeof query;
    if (!canSeeAll && user.churchId) query = (query as ReturnType<typeof supabaseAdmin.from>).eq("church_id", user.churchId) as typeof query;
    if (from) query = (query as ReturnType<typeof supabaseAdmin.from>).gte("created_at", from) as typeof query;
    if (to)   query = (query as ReturnType<typeof supabaseAdmin.from>).lte("created_at", to + "T23:59:59Z") as typeof query;

    const { data: creds, error } = await query.limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!creds || creds.length === 0) return NextResponse.json([]);

    // ── 2. Busca dados dos membros via Prisma ─────────────────────────────
    const memberIds = [...new Set(
      creds.map((c: Record<string, unknown>) => c.member_id as string).filter(Boolean)
    )];

    const members = memberIds.length > 0
      ? await prisma.member.findMany({
          where: { id: { in: memberIds }, deletedAt: null },
          select: {
            id: true, fullName: true, preferredName: true, photoUrl: true,
            cpf: true, rg: true, birthDate: true, gender: true, maritalStatus: true,
            ecclesiasticalTitle: true, membershipStatus: true, membershipDate: true,
            baptismDate: true, fatherName: true, motherName: true, spouseName: true,
            naturalityCity: true, naturalityState: true, memberType: true, rol: true,
            churchId: true,
            church: {
              select: {
                id: true, name: true, code: true,
                regional: {
                  select: {
                    id: true, name: true, code: true,
                    campo: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        })
      : [];

    const memberMap = new Map(members.map((m) => [m.id, m]));

    // ── 3. Busca modelos de credencial (tbcarteirinha) ────────────────────
    const { data: models } = await supabaseAdmin.from("tbcarteirinha").select("*");
    const modelMap = new Map(
      (models || []).map((m: Record<string, unknown>) => [m.nome as string, m])
    );

    // ── 4. Busca igrejas faltantes (church_id sem member_id) ─────────────
    const churchIds = [...new Set(
      creds
        .filter((c: Record<string, unknown>) => c.church_id && !c.member_id)
        .map((c: Record<string, unknown>) => c.church_id as string)
    )];

    const churches = churchIds.length > 0
      ? await prisma.church.findMany({
          where: { id: { in: churchIds } },
          select: {
            id: true, name: true, code: true,
            regional: {
              select: {
                id: true, name: true, code: true,
                campo: { select: { id: true, name: true } },
              },
            },
          },
        })
      : [];

    const churchMap = new Map(churches.map((c) => [c.id, c]));

    // ── 5. Monta linhas enriquecidas ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = creds.map((c: Record<string, unknown>) => {
      const member = c.member_id ? memberMap.get(c.member_id as string) : null;
      const church = member?.church ?? churchMap.get(c.church_id as string) ?? null;
      const regional = church?.regional ?? null;
      const campo = regional?.campo ?? null;

      // Modelo: busca pelo nomecarteirinha ou pelo campo tipo/modelo
      const modelKey = (c.nomecarteirinha as string) || (c.modelo as string) || (c.tipo as string) || "";
      const model = modelMap.get(modelKey) || null;

      // Filtros por hierarquia aplicados aqui (quando não filtramos pela church_id diretamente)
      if (regionalId && regional?.id !== regionalId) return null;
      if (campoId && campo?.id !== campoId) return null;

      return {
        // Campos da tbcredencial
        id:               c.id,
        nome:             c.nome ?? "",
        tipo:             c.tipo ?? "",
        numero:           c.numero ?? "",
        situacao:         c.situacao ?? "",
        obs:              c.obs ?? "",
        dataemissao:      c.dataemissao ?? "",
        datavalidade:     c.datavalidade ?? "",
        dataaprovacao:    c.dataaprovacao ?? "",
        aprovadopor:      c.aprovadopor ?? "",
        igrejasolicitante: c.igrejasolicitante ?? "",
        campo:            c.campo ?? "",
        modelo:           (c.nomecarteirinha as string) || (c.modelo as string) || "",
        card_protocol:    c.card_protocol ?? "",
        church_id:        c.church_id ?? "",
        created_at:       c.created_at ?? "",
        // via, frente, verso (colunas novas do import)
        via:              c.via ?? "",
        frente:           c.frente ?? "",
        verso:            c.verso ?? "",
        // Hierarquia
        churchName:   church ? (church.code ? `${church.code} - ${church.name}` : church.name) : (c.igrejasolicitante ?? ""),
        regionalId:   regional?.id ?? "",
        regionalName: regional ? (regional.code ? `${regional.code} - ${regional.name}` : regional.name) : "",
        fieldId:      campo?.id ?? "",
        fieldName:    campo?.name ?? "",
        // Dados do membro
        member: member ? {
          id:                member.id,
          fullName:          member.fullName ?? "",
          preferredName:     member.preferredName ?? "",
          photoUrl:          member.photoUrl ?? "",
          cpf:               member.cpf ?? "",
          rg:                member.rg ?? "",
          birthDate:         member.birthDate ? String(member.birthDate).slice(0, 10) : "",
          gender:            member.gender ?? "",
          maritalStatus:     member.maritalStatus ?? "",
          ecclesiasticalTitle: member.ecclesiasticalTitle ?? "",
          membershipStatus:  member.membershipStatus ?? "",
          membershipDate:    member.membershipDate ? String(member.membershipDate).slice(0, 10) : "",
          baptismDate:       member.baptismDate ? String(member.baptismDate).slice(0, 10) : "",
          fatherName:        member.fatherName ?? "",
          motherName:        member.motherName ?? "",
          spouseName:        member.spouseName ?? "",
          naturalityCity:    member.naturalityCity ?? "",
          naturalityState:   member.naturalityState ?? "",
          memberType:        member.memberType ?? "",
          rol:               member.rol ? String(member.rol) : "",
        } : null,
        // Dados do modelo (tbcarteirinha)
        modelLargura:      model ? (model.largura ?? null) : null,
        modelAltura:       model ? (model.altura ?? null) : null,
        modelLargurapg:    model ? (model.largurapg ?? null) : null,
        modelAlturapg:     model ? (model.alturapg ?? null) : null,
        modelLinhaporpg:   model ? (model.linhaporpg ?? null) : null,
        modelColunaporpg:  model ? (model.colunaporpg ?? null) : null,
        modelValidademeses: model ? (model.validademeses ?? null) : null,
      };
    }).filter(Boolean);

    return NextResponse.json(rows);
  });
}
