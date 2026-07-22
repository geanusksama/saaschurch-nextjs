import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const sp = new URL(req.url).searchParams;
      const churchIdParam = sp.get("churchId");

      const where: any = {};

      // Enforce multi-tenant access control boundaries based on user profiles
      if (user.profileType === "church") {
        where.churchId = user.churchId;
      } else if (user.profileType === "campo") {
        where.church = {
          regional: {
            campoId: user.campoId
          }
        };
      } else if (user.profileType === "admin") {
        if (user.churchId) {
          where.churchId = user.churchId;
        }
      }

      // Filter by a specific church if requested (only if allowed by tenant restrictions)
      if (churchIdParam && churchIdParam !== "all") {
        if (user.profileType === "church" && churchIdParam !== user.churchId) {
          return NextResponse.json({ error: "Acesso negado para esta igreja" }, { status: 403 });
        }
        where.churchId = churchIdParam;
      }

      const devices = await prisma.faceidDevice.findMany({
        where,
        include: {
          church: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return NextResponse.json(devices);
    } catch (err: any) {
      console.error("DEBUG: Error listing FaceID devices:", err);
      return NextResponse.json({ error: err.message || "Erro ao buscar dispositivos" }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();
      const { serial, name, username, password, churchId, localHost, localPort, agentToken, isSede, secondaryChurchId } = body;

      if (!serial || !name || !churchId) {
        return NextResponse.json({ error: "Serial, Nome e Igreja são obrigatórios" }, { status: 400 });
      }

      // Validate permission for the target church
      if (user.profileType === "church" && churchId !== user.churchId) {
        return NextResponse.json({ error: "Acesso negado. Você só pode cadastrar dispositivos para a sua própria igreja." }, { status: 403 });
      }

      const newDevice = await prisma.faceidDevice.create({
        data: {
          serial: String(serial).trim(),
          name: String(name).trim(),
          username: username ? String(username).trim() : null,
          password: password ? String(password).trim() : null,
          churchId,
          localHost: localHost ? String(localHost).trim() : null,
          localPort: localPort ? Number(localPort) : 80,
          agentToken: agentToken ? String(agentToken).trim() : null,
          isSede: isSede !== undefined ? Boolean(isSede) : true,
          secondaryChurchId: secondaryChurchId || null
        }
      });

      return NextResponse.json(newDevice, { status: 201 });
    } catch (err: any) {
      console.error("DEBUG: Error creating FaceID device:", err);
      if (err.code === "P2002") {
        return NextResponse.json({ error: "Já existe um dispositivo cadastrado com este ID/Serial." }, { status: 400 });
      }
      return NextResponse.json({ error: err.message || "Erro ao cadastrar dispositivo" }, { status: 500 });
    }
  });
}
