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
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Imagem muito grande. Máximo: 5MB." }, { status: 400 });
      }

      let compressedBuffer = buffer;
      const fileSize = buffer.length;

      // Primeiro valida se é uma imagem
      try {
        await sharp(buffer).metadata();
      } catch (err: any) {
        console.error("Arquivo não é imagem válida:", err?.message);
        return NextResponse.json(
          { error: "Arquivo não é uma imagem válida. Tente JPG, PNG, HEIC ou WebP." },
          { status: 400 }
        );
      }

      // Tenta converter para PNG
      try {
        compressedBuffer = await sharp(buffer, { animated: false })
          .resize(2048, 2048, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } catch (compressionError: any) {
        console.error("Erro ao comprimir com resize:", compressionError?.message);

        try {
          // Tenta sem resize
          compressedBuffer = await sharp(buffer)
            .png({ compressionLevel: 6 })
            .toBuffer();
        } catch (fallbackError: any) {
          console.error("Erro ao comprimir sem resize:", fallbackError?.message);
          return NextResponse.json(
            { error: "Formato de imagem não suportado ou corrompido." },
            { status: 400 }
          );
        }
      }

      // Valida o PNG gerado
      if (compressedBuffer.length < 100) {
        return NextResponse.json(
          { error: "Erro ao processar imagem - arquivo vazio." },
          { status: 400 }
        );
      }

      // Valida se o PNG gerado é válido
      try {
        await sharp(compressedBuffer).metadata();
      } catch (validationError: any) {
        console.error("PNG gerado é inválido:", validationError?.message);
        return NextResponse.json(
          { error: "Erro ao processar imagem. Tente com outro arquivo." },
          { status: 400 }
        );
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
      const path = `fotodespesa/${fileName}`;

      const { error } = await supabaseAdmin.storage
        .from("fotos")
        .upload(path, compressedBuffer, { upsert: true, contentType: "image/png" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: urlData } = supabaseAdmin.storage.from("fotos").getPublicUrl(path);
      return NextResponse.json({ url: urlData.publicUrl });
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  });
}
