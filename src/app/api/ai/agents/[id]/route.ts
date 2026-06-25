import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await context.params;
      const { name, description, role, systemPrompt, avatarUrl, isActive } = await req.json().catch(() => ({}));

      const agent = await prisma.aiAgent.findUnique({
        where: { id }
      });

      if (!agent) {
        return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
      }

      // Segurança: Apenas quem criou/campo dono ou master pode alterar
      if (agent.campoId && agent.campoId !== user.campoId && user.profileType !== "master") {
        return NextResponse.json({ error: "Sem permissão para alterar este agente." }, { status: 403 });
      }

      const updatedAgent = await prisma.aiAgent.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(role !== undefined && { role }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(avatarUrl !== undefined && { avatarUrl }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date()
        }
      });

      return NextResponse.json(updatedAgent);
    } catch (e) {
      console.error("[PUT /api/ai/agents/[id]]", e);
      return NextResponse.json({ error: "Erro ao atualizar agente." }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await context.params;

      const agent = await prisma.aiAgent.findUnique({
        where: { id }
      });

      if (!agent) {
        return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
      }

      if (agent.campoId && agent.campoId !== user.campoId && user.profileType !== "master") {
        return NextResponse.json({ error: "Sem permissão para deletar este agente." }, { status: 403 });
      }

      await prisma.aiAgent.delete({
        where: { id }
      });

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[DELETE /api/ai/agents/[id]]", e);
      return NextResponse.json({ error: "Erro ao deletar agente." }, { status: 500 });
    }
  });
}
