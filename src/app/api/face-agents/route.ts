import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

/**
 * Token do agente por igreja (a máquina que roda na rede daquela igreja).
 * GET  → token existente da igreja (se houver)
 * POST → cria/renova o token da igreja
 */

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const churchId = new URL(req.url).searchParams.get("churchId");
    if (!churchId) return NextResponse.json({ error: "churchId obrigatório." }, { status: 400 });

    if (user.profileType === "church" && churchId !== user.churchId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const agent = await prisma.faceidAgent.findUnique({ where: { churchId } });
    return NextResponse.json(agent || null);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const churchId = body.churchId as string;
    const name = (body.name as string) || null;
    if (!churchId) return NextResponse.json({ error: "churchId obrigatório." }, { status: 400 });

    if (user.profileType === "church" && churchId !== user.churchId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const token = (randomUUID() + randomUUID()).replace(/-/g, "");

    // Uma igreja tem um agente (unique em church_id): cria ou renova o token.
    const agent = await prisma.faceidAgent.upsert({
      where: { churchId },
      create: { churchId, token, name },
      update: { token, name: name ?? undefined },
    });

    return NextResponse.json(agent, { status: 201 });
  });
}
