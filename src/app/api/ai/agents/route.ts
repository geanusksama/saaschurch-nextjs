import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const campoId = user.campoId || null;

      const agents = await prisma.aiAgent.findMany({
        where: {
          OR: [
            { campoId },
            { campoId: null }
          ]
        },
        orderBy: { createdAt: "desc" }
      });

      return NextResponse.json(agents);
    } catch (e) {
      console.error("[GET /api/ai/agents]", e);
      return NextResponse.json({ error: "Erro ao obter agentes." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const campoId = user.campoId || null;
      const { name, description, role, systemPrompt, avatarUrl, isActive } = await req.json().catch(() => ({}));

      if (!name || !role || !systemPrompt) {
        return NextResponse.json({ error: "Nome, especialidade/função e prompt de sistema são obrigatórios." }, { status: 400 });
      }

      const agent = await prisma.aiAgent.create({
        data: {
          campoId,
          churchId: user.churchId || null,
          name,
          description,
          role,
          systemPrompt,
          avatarUrl,
          isActive: isActive !== undefined ? isActive : true
        }
      });

      return NextResponse.json(agent, { status: 201 });
    } catch (e) {
      console.error("[POST /api/ai/agents]", e);
      return NextResponse.json({ error: "Erro ao criar agente." }, { status: 500 });
    }
  });
}
