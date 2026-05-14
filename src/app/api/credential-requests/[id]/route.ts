import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const canSeeAll = user.profileType === "master" || user.profileType === "admin" || user.profileType === "campo";
    const body = await req.json().catch(() => ({}));
    const { situacao, obs, datavalidade, dataemissao, nome, numero } = body;
    const data: Record<string, unknown> = {};
    if (situacao !== undefined) data.situacao = situacao;
    if (obs !== undefined) data.obs = obs;
    if (datavalidade !== undefined) data.datavalidade = datavalidade;
    if (dataemissao !== undefined) data.dataemissao = dataemissao;
    if (nome !== undefined) data.nome = nome;
    if (numero !== undefined) data.numero = numero;
    data.updated_at = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin.from("tbcredencial").update(data).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const canSeeAll = user.profileType === "master" || user.profileType === "admin" || user.profileType === "campo";
    const { data: existing } = await supabaseAdmin.from("tbcredencial").select("*").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!canSeeAll && user.churchId && existing.church_id !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from("tbcredencial").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (existing.kan_card_id) {
      await prisma.kanCard.update({ where: { id: existing.kan_card_id }, data: { deletedAt: new Date(), updatedBy: user.id || null } }).catch(() => {});
    }
    return new NextResponse(null, { status: 204 });
  });
}
