import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}.${ext}`;
      const path = `fotodespesa/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error } = await supabaseAdmin.storage
        .from("fotos")
        .upload(path, buffer, { upsert: true, contentType: file.type });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: urlData } = supabaseAdmin.storage.from("fotos").getPublicUrl(path);
      return NextResponse.json({ url: urlData.publicUrl });
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  });
}
