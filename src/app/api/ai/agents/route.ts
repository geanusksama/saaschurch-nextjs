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

      // scope=manage é a tela "Assistentes": master/admin administram todos,
      // senão marcariam um agente para outra pessoa e perderiam o próprio
      // acesso à edição. Sem o scope (as listas de escolha), a regra é dura:
      // só vê quem está marcado — master incluído.
      const scope = new URL(req.url).searchParams.get("scope");
      const isManaging = scope === "manage" && ["master", "admin"].includes(user.profileType);

      // Agente com visão bloqueada existe só dentro da tela Assistentes. Fora
      // dela (widget de chat, Envios, pastoral) ele nem é listado — nem para
      // quem está marcado nele. scope=assistentes é a própria tela pedindo a
      // lista para USO, então lá ele aparece.
      const inAssistants = scope === "manage" || scope === "assistentes";
      const scoped = inAssistants ? agents : agents.filter(a => a.visibility !== "restrito");

      const visible = isManaging
        ? scoped
        : await filterAgentsForUser(scoped, user.id ? String(user.id) : null);

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
      const { name, description, role, systemPrompt, avatarUrl, isActive, visibility, userIds } = await req.json().catch(() => ({}));

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
          isActive: isActive !== undefined ? isActive : true,
          visibility: visibility === "restrito" ? "restrito" : "global"
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
