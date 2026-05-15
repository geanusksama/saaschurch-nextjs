import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Generic file upload endpoint used by Requerimentos and other modules.
 * Stores files in the 'dados' bucket under 'requerimentos/' folder.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const ext = file.name.split(".").pop() || "bin";
      const sanitized = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 80);
      const fileName = `${Date.now()}_${sanitized}`;
      const folder = (formData.get("folder") as string | null) || "uploads";
      const path = `${folder}/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error } = await supabaseAdmin.storage
        .from("dados")
        .upload(path, buffer, { upsert: true, contentType: file.type || "application/octet-stream" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: urlData } = supabaseAdmin.storage.from("dados").getPublicUrl(path);
      return NextResponse.json({ url: urlData.publicUrl });
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  });
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
