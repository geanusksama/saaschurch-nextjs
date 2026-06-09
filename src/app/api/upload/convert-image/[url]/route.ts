import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import sharp from "sharp";

const CACHE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET(req: NextRequest, { params }: { params: Promise<{ url: string }> }) {
  try {
    const { url } = await params;
    const decodedUrl = decodeURIComponent(url);

    if (!decodedUrl.startsWith("https://")) {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }

    const imageResponse = await fetch(decodedUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Falha ao buscar imagem" }, { status: 404 });
    }

    const contentType = imageResponse.headers.get("content-type") || "";
    const buffer = await imageResponse.arrayBuffer();

    // Detecta se é imagem e converte para PNG
    const urlLower = decodedUrl.toLowerCase();
    const isImageLike =
      contentType.includes("image/") ||
      contentType.includes("heic") ||
      contentType.includes("webp") ||
      contentType === "application/octet-stream" ||
      /\.(heic|heif|webp|tiff|bmp|gif|jpg|jpeg|png)$/i.test(urlLower);

    if (isImageLike) {
      try {
        const convertedBuffer = await sharp(Buffer.from(buffer), { animated: false })
          .resize(2048, 2048, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();

        return new NextResponse(convertedBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          },
        });
      } catch (error) {
        console.error("Erro ao converter imagem:", error);
        return NextResponse.json({ error: "Falha ao processar imagem" }, { status: 400 });
      }
    }

    // Se não for imagem, retorna como está
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
      },
    });
  } catch (error) {
    console.error("Erro ao converter imagem:", error);
    return NextResponse.json({ error: "Falha ao processar imagem" }, { status: 500 });
  }
}
