import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Nenhum arquivo fornecido." }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Imagem muito grande. Máximo: 5MB." }, { status: 400 });
      }

      let compressedBuffer = buffer;
      const fileSize = buffer.length;

      try {
        compressedBuffer = await sharp(buffer, { animated: false })
          .resize(2048, 2048, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } catch (compressionError: any) {
        console.error("Erro ao comprimir imagem:", compressionError?.message, "Tamanho:", fileSize);

        if (fileSize < 100) {
          return NextResponse.json(
            { error: "Arquivo muito pequeno ou inválido." },
            { status: 400 }
          );
        }

        try {
          await sharp(buffer).metadata();
          compressedBuffer = await sharp(buffer)
            .png({ compressionLevel: 6 })
            .toBuffer();
        } catch (fallbackError: any) {
          console.error("Arquivo não é imagem válida:", fallbackError?.message);
          return NextResponse.json(
            { error: "Arquivo não é uma imagem válida. Tente JPG, PNG, HEIC ou WebP." },
            { status: 400 }
          );
        }
      }

      if (compressedBuffer.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Imagem comprimida ainda excede 5MB. Tente com resolução menor." },
          { status: 400 }
        );
      }

      const sanitized = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 80)
        .replace(/\.[^/.]+$/, ".png");
      const fileName = `${Date.now()}_${sanitized}`;
      const path = `church-photos/${fileName}`;

      const { error } = await supabaseAdmin.storage
        .from("dados")
        .upload(path, compressedBuffer, { upsert: true, contentType: "image/png" });

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
