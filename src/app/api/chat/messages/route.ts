import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    let campoId = user.campoId;
    if (user.profileType === "master") {
      const { searchParams } = new URL(req.url);
      campoId = searchParams.get("campoId") || user.campoId;
    }

    if (!campoId) {
      return NextResponse.json([]);
    }

    try {
      const messages = await prisma.internalChatMessage.findMany({
        where: { campoId },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      return NextResponse.json(serializeBigInts(messages));
    } catch (error) {
      console.error("[chat_messages_get]", error);
      return NextResponse.json({ error: "Erro ao carregar mensagens." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    let campoId = user.campoId;
    if (user.profileType === "master") {
      const { searchParams } = new URL(req.url);
      campoId = searchParams.get("campoId") || user.campoId;
    }

    if (!campoId) {
      return NextResponse.json({ error: "Campo não especificado." }, { status: 400 });
    }

    try {
      const bodyData = await req.json();
      const { body, fileUrl, fileName, fileType, fileSize } = bodyData;

      if (!body && !fileUrl) {
        return NextResponse.json({ error: "Conteúdo da mensagem vazio." }, { status: 400 });
      }

      if (!user.id) {
        return NextResponse.json({ error: "Usuário não autenticado no banco de dados." }, { status: 401 });
      }

      const message = await prisma.internalChatMessage.create({
        data: {
          campoId,
          userId: user.id,
          userName: user.fullName || "Usuário",
          userRole: user.roleName || (user.profileType === "master" ? "Master" : user.profileType === "admin" ? "Administrador" : user.profileType === "campo" ? "Campo" : "Igreja"),
          body: body || null,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileType: fileType || null,
          fileSize: fileSize ? Number(fileSize) : null,
        },
      });

      return NextResponse.json(serializeBigInts(message));
    } catch (error) {
      console.error("[chat_messages_post]", error);
      return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });
    }
  });
}
