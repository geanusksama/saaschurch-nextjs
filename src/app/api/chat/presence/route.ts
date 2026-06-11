import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

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

    // Active time window: last 25 seconds
    const threshold = new Date(Date.now() - 25000);

    try {
      const onlineUsers = await prisma.user.findMany({
        where: {
          campoId,
          deletedAt: null,
          lastActiveAt: {
            gte: threshold,
          },
        },
        select: {
          id: true,
          fullName: true,
          presenceStatus: true,
          customStatus: true,
          lastActiveAt: true,
          role: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          fullName: "asc",
        },
      });

      const formatted = onlineUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        presenceStatus: u.presenceStatus,
        customStatus: u.customStatus,
        lastActiveAt: u.lastActiveAt,
        roleName: u.role?.name || null,
      }));

      return NextResponse.json(formatted);
    } catch (error) {
      console.error("[chat_presence_get]", error);
      return NextResponse.json({ error: "Erro ao carregar presença." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.id) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    try {
      const body = await req.json().catch(() => ({}));
      const { presenceStatus, customStatus } = body;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          presenceStatus: presenceStatus || "online",
          customStatus: customStatus !== undefined ? customStatus : undefined,
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[chat_presence_post]", error);
      return NextResponse.json({ error: "Erro ao atualizar presença." }, { status: 500 });
    }
  });
}
