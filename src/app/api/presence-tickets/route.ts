import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withAuth } from "../../../lib/auth";

function generateTicketCode(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function isRestrictedToOwnChurch(user: { profileType: string; roleName?: string | null; churchId?: string | null }) {
  if (user.profileType === "church" && user.churchId) return true;
  if (!user.churchId) return false;
  const name = String(user.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return name.includes("secret") || name.includes("tesour");
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    let churchId = searchParams.get("church_id");
    const dataInicial = searchParams.get("data_inicial");
    let campoId = searchParams.get("campo_id") || user.campoId;

    if (user.profileType !== "master") {
      if (!user.campoId) {
        return NextResponse.json([]);
      }
      campoId = user.campoId;
    }

    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) {
        return NextResponse.json([]);
      }
      churchId = user.churchId;
    }

    // Validate churchId scope against allowed campo
    if (churchId && user.profileType !== "master" && campoId) {
      const church = await prisma.church.findFirst({
        where: {
          id: churchId,
          deletedAt: null,
          regional: { campoId }
        }
      });
      if (!church) {
        return NextResponse.json([]);
      }
    }

    const tickets = await prisma.churchPresenceTicket.findMany({
      where: {
        ...(campoId ? { campoId } : {}),
        ...(churchId ? { churchId } : {}),
        ...(dataInicial ? { dataCulto: { gte: new Date(dataInicial) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    return NextResponse.json(tickets);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    let { churchId, dataCulto, quantidade, campoId } = body;

    let targetCampoId = campoId || user.campoId;

    if (user.profileType !== "master") {
      if (!user.campoId) {
        return NextResponse.json({ error: "Contexto de campo não identificado." }, { status: 400 });
      }
      targetCampoId = user.campoId;
    }

    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) {
        return NextResponse.json({ error: "Acesso negado. Usuário sem igreja vinculada." }, { status: 403 });
      }
      churchId = user.churchId;
    }

    if (!dataCulto) {
      return NextResponse.json({ error: "Data do culto é obrigatória." }, { status: 400 });
    }

    const qty = Number(quantidade) || 1;
    if (qty <= 0 || qty > 1000) {
      return NextResponse.json({ error: "Quantidade inválida (máximo 1000 por lote)." }, { status: 400 });
    }

    let churchName: string | null = null;
    let regionalName: string | null = null;

    if (churchId) {
      // Validate that the church exists and belongs to the target campo
      const church = await prisma.church.findFirst({
        where: { 
          id: churchId, 
          deletedAt: null,
          ...(user.profileType !== "master" && targetCampoId ? { regional: { campoId: targetCampoId } } : {})
        },
        include: { regional: true }
      });
      if (!church) {
        return NextResponse.json({ error: "Igreja não encontrada ou não pertence ao seu campo." }, { status: 400 });
      }
      churchName = church.name;
      regionalName = church.regional?.name || null;
      if (user.profileType === "master") {
        targetCampoId = church.regional?.campoId || targetCampoId;
      }
    }

    if (!targetCampoId) {
      return NextResponse.json({ error: "Campo não especificado." }, { status: 400 });
    }

    const ticketsData = [];
    const dateObj = new Date(dataCulto);

    for (let i = 0; i < qty; i++) {
      ticketsData.push({
        campoId: targetCampoId,
        churchId: churchId || null,
        churchName,
        regionalName,
        dataCulto: dateObj,
        ticketCode: `TKT-${generateTicketCode(8)}`,
        membroRol: "",
        createdBy: user.id || null,
      });
    }

    await prisma.churchPresenceTicket.createMany({
      data: ticketsData
    });

    return NextResponse.json({ ok: true, generated: qty });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.campoId) {
      return NextResponse.json({ error: "Contexto de campo não identificado." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "IDs não informados." }, { status: 400 });
    }

    const tickets = await prisma.churchPresenceTicket.findMany({
      where: {
        id: { in: ids },
        campoId: user.campoId,
      }
    });

    if (tickets.length === 0) {
      return NextResponse.json({ error: "Nenhum ticket encontrado." }, { status: 404 });
    }

    let finalIds = tickets.map(t => t.id);
    if (isRestrictedToOwnChurch(user)) {
      finalIds = tickets
        .filter(t => t.churchId === user.churchId)
        .map(t => t.id);
    }

    if (finalIds.length === 0) {
      return NextResponse.json({ error: "Sem acesso a estes tickets." }, { status: 403 });
    }

    await prisma.churchPresenceTicket.deleteMany({
      where: { id: { in: finalIds } }
    });

    return new NextResponse(null, { status: 204 });
  });
}


