import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    // Active time window: last 25 seconds
    const threshold = new Date(Date.now() - 25000);

    try {
      const isMasterSupportOrAdmin =
        user.profileType === "master" ||
        user.profileType === "admin" ||
        (user.roleName && (
          user.roleName.toLowerCase().includes("suporte") ||
          user.roleName.toLowerCase().includes("admin") ||
          user.roleName.toLowerCase().includes("master")
        ));

      const whereClause: any = {
        deletedAt: null,
      };

      if (!isMasterSupportOrAdmin) {
        whereClause.campoId = user.campoId || "00000000-0000-0000-0000-000000000000";
      } else {
        const { searchParams } = new URL(req.url);
        const paramCampoIds = searchParams.get("campoIds");
        const paramCampoId = searchParams.get("campoId");
        if (paramCampoIds !== null) {
          const ids = paramCampoIds.split(",").filter(Boolean);
          whereClause.campoId = { in: ids };
        } else if (paramCampoId) {
          whereClause.campoId = paramCampoId;
        }
      }

      const allUsers = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          fullName: true,
          email: true,
          presenceStatus: true,
          customStatus: true,
          lastActiveAt: true,
          profileType: true,
          campoId: true,
          role: {
            select: {
              name: true,
            },
          },
          church: {
            select: {
              name: true,
            },
          },
          campo: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          fullName: "asc",
        },
      });

      // Filter: Exclude master, admin, and support profiles/roles from the contacts list (they shouldn't be called directly)
      const filteredUsers = allUsers.filter((u) => {
        if (u.id === user.id) return false; // Exclude self from contact list

        const profile = (u.profileType || "").toLowerCase();
        const roleName = (u.role?.name || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        const isExcludedProfile = ["master", "admin"].includes(profile);
        const isExcludedRole =
          roleName.includes("master") ||
          roleName.includes("admin") ||
          roleName.includes("suporte") ||
          roleName.includes("support");

        if (isExcludedProfile || isExcludedRole) {
          return false;
        }

        // Only include "campo" profile or roles containing "secret", "tesour", "campo"
        if (profile === "campo") {
          return true;
        }

        if (
          roleName.includes("secret") ||
          roleName.includes("tesour") ||
          roleName.includes("campo")
        ) {
          return true;
        }
        return false;
      });

      const formatted = filteredUsers.map((u) => {
        const isOnline =
          u.presenceStatus !== "furtivo" &&
          u.lastActiveAt &&
          new Date(u.lastActiveAt).getTime() >= threshold.getTime();

        return {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          presenceStatus: isOnline ? u.presenceStatus : "offline",
          customStatus: u.customStatus,
          lastActiveAt: u.lastActiveAt,
          roleName: u.role?.name || (u.profileType ? u.profileType.toUpperCase() : null),
          churchName: u.church?.name || null,
          campoName: u.campo?.name || null,
          campoId: u.campoId,
        };
      });

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
