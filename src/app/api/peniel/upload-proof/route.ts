import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MAX = 8 * 1024 * 1024; // 8MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "application/pdf"];

// POST /api/peniel/upload-proof  (público)
// Upload do comprovante de pagamento. Aceita imagem ou PDF e devolve a URL pública.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Formato inválido. Envie imagem (JPG/PNG) ou PDF." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo: 8MB." }, { status: 400 });
    }

    const ext = file.type === "application/pdf" ? "pdf" : (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
    const path = `peniel/comprovantes/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from("dados")
      .upload(path, buffer, { upsert: true, contentType: file.type });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = supabaseAdmin.storage.from("dados").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
