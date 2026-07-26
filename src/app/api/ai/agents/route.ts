import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { filterAgentsForUser, loadAgentUserIds, replaceAgentUsers } from "@/lib/aiAgentAccess";

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

      // Só os agentes que este usuário pode ver (master vê todos). É isto que
      // impede, por exemplo, o agente do Financeiro de aparecer na escolha de
      // quem não foi autorizado nele.
      const visible = await filterAgentsForUser(agents, user.id ? String(user.id) : null, user.profileType);

      // A tela de gestão precisa saber quem está marcado em cada agente
      const userIds = await loadAgentUserIds(visible.map(a => a.id));

      return NextResponse.json(
        visible.map(a => ({ ...a, userIds: userIds.get(a.id) ?? [] }))
      );
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
      const { name, description, role, systemPrompt, avatarUrl, isActive, userIds } = await req.json().catch(() => ({}));

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

      if (Array.isArray(userIds)) {
        await replaceAgentUsers(agent.id, userIds.map(String), user.id ? String(user.id) : null);
      }

      return NextResponse.json({ ...agent, userIds: Array.isArray(userIds) ? userIds : [] }, { status: 201 });
    } catch (e) {
      console.error("[POST /api/ai/agents]", e);
      return NextResponse.json({ error: "Erro ao criar agente." }, { status: 500 });
    }
  });
}
