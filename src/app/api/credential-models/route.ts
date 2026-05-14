import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const { data, error } = await supabaseAdmin.from("tbcarteirinha").select("*").order("id", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { nome, tipo, descricao, largura, altura, largurapg, alturapg, linhaporpg, colunaporpg, frente, verso, ativo, validademeses } = body;
    if (!nome && !tipo) return NextResponse.json({ error: "nome is required" }, { status: 400 });
    const campo = (user as Record<string, unknown>).campo || body.campo || null;
    const { data, error } = await supabaseAdmin.from("tbcarteirinha")
      .insert({ nome: nome || tipo, tipo: tipo || nome, descricao: descricao || null, largura: largura || null, altura: altura || null, largurapg: largurapg || null, alturapg: alturapg || null, linhaporpg: linhaporpg || null, colunaporpg: colunaporpg || null, frente: frente || null, verso: verso || null, ativo: ativo ?? true, campo, validademeses: validademeses || null })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  });
}
