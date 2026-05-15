import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { nome, tipo, descricao, largura, altura, largurapg, alturapg, linhaporpg, colunaporpg, frente, verso, ativo, validademeses } = body;
    const { data, error } = await supabaseAdmin.from("tbcarteirinha")
      .update({ nome: nome || tipo, tipo: tipo || nome, descricao: descricao ?? undefined, largura: largura || null, altura: altura || null, largurapg: largurapg || null, alturapg: alturapg || null, linhaporpg: linhaporpg || null, colunaporpg: colunaporpg || null, frente: frente || null, verso: verso || null, ativo: ativo ?? true, validademeses: validademeses || null })
      .eq("id", Number(id)).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from("tbcarteirinha")
      .delete()
      .eq("id", Number(id))
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  });
}
