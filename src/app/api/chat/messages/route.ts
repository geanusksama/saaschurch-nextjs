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

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");

    try {
      if (contactId) {
        // Fetch 1-to-1 conversation messages between current user and contactId
        const messages = await prisma.internalChatMessage.findMany({
          where: {
            campoId,
            OR: [
              { userId: user.id, receiverId: contactId },
              { userId: contactId, receiverId: user.id }
            ]
          },
          orderBy: { createdAt: "asc" },
          take: 100 // load up to 100 messages
        });

        return NextResponse.json(serializeBigInts(messages));
      } else {
        // Fetch Conversations List
        // 1. Fetch all messages in the Campo involving the current user
        const allMyMessages = await prisma.internalChatMessage.findMany({
          where: {
            campoId,
            OR: [
              { userId: user.id },
              { receiverId: user.id }
            ]
          },
          orderBy: { createdAt: "desc" }
        });

        // 2. Group by the other participant
        const conversationsMap = new Map<string, any>();
        for (const msg of allMyMessages) {
          const partnerId = msg.userId === user.id ? msg.receiverId : msg.userId;
          if (!partnerId) continue;
          
          if (!conversationsMap.has(partnerId)) {
            conversationsMap.set(partnerId, msg);
          }
        }

        const partnerIds = Array.from(conversationsMap.keys());
        if (partnerIds.length === 0) {
          return NextResponse.json([]);
        }

        // 3. Fetch partners details
        const partners = await prisma.user.findMany({
          where: {
            id: { in: partnerIds }
          },
          select: {
            id: true,
            fullName: true,
            presenceStatus: true,
            customStatus: true,
            lastActiveAt: true,
            role: {
              select: {
                name: true
              }
            }
          }
        });

        // 4. Threshold for active status (last 25 seconds)
        const threshold = new Date(Date.now() - 25000);

        // 5. Build response array matching the conversation details
        const result = partners.map(p => {
          const lastMsg = conversationsMap.get(p.id);
          const isOnline = p.presenceStatus !== "furtivo" &&
            p.lastActiveAt &&
            new Date(p.lastActiveAt).getTime() >= threshold.getTime();

          return {
            id: p.id,
            fullName: p.fullName,
            presenceStatus: isOnline ? p.presenceStatus : "offline",
            customStatus: p.customStatus,
            roleName: p.role?.name || null,
            lastMessage: {
              body: lastMsg.body,
              fileType: lastMsg.fileType,
              fileName: lastMsg.fileName,
              createdAt: lastMsg.createdAt,
              senderId: lastMsg.userId
            }
          };
        });

        // Sort by last message createdAt desc
        result.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

        return NextResponse.json(serializeBigInts(result));
      }
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
      const { body, fileUrl, fileName, fileType, fileSize, receiverId } = bodyData;

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
          receiverId: receiverId || null
        },
      });

      return NextResponse.json(serializeBigInts(message));
    } catch (error) {
      console.error("[chat_messages_post]", error);
      return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });
    }
  });
}
