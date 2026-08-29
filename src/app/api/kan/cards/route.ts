import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter, isRestrictedToOwnChurch, buildProtocol } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyMatrixRule } from "@/lib/kanMatrix";
import { ehServicoDeReadmissao } from "@/lib/readmissaoTitulo";
import { normalizarTituloDoCatalogo } from "@/lib/tituloEclesiasticoHistorico";

// A regra da matriz é executada pelo módulo compartilhado: existia uma cópia
// idêntica aqui, e uma cópia a menos é uma chance a menos de as duas
// divergirem — foi o que aconteceu com a restauração de título na readmissão,
// que só valeria no caminho de mover o card.

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { stageId, serviceId, churchId, memberId, candidateName, destinationChurchId, originRegionalId, destinationRegionalId, requesterChurchId, requestedChurchId, requesterName, subject, justification, observations, description, intendedTitle, metadata, attachments } = body;

    if (isRestrictedToOwnChurch(user) && user.churchId && churchId !== user.churchId) {
      return NextResponse.json({ error: "Perfil de igreja só pode abrir processos da própria igreja." }, { status: 403 });
    }
    if (!serviceId || !churchId) return NextResponse.json({ error: "serviceId, churchId required" }, { status: 400 });

    const service = await prisma.kanService.findUnique({ where: { id: Number(serviceId) } });
    if (!service) return NextResponse.json({ error: "service not found" }, { status: 404 });

    let stage = null;
    if (stageId) {
      stage = await prisma.kanStage.findUnique({ where: { id: Number(stageId) }, include: { columns: { where: { columnIndex: 1 }, take: 1 } } });
    }
    if (!stage || !stage.columns?.length) {
      const firstRule = await prisma.kanMatrixRule.findFirst({ where: { serviceId: Number(serviceId), columnIndex: 1, isActive: true }, orderBy: { id: "asc" }, select: { stageId: true } });
      if (firstRule?.stageId) {
        stage = await prisma.kanStage.findUnique({ where: { id: Number(firstRule.stageId) }, include: { columns: { where: { columnIndex: 1 }, take: 1 } } });
      }
    }
    if (!stage) return NextResponse.json({ error: "stage not found" }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "stage has no first column" }, { status: 400 });

    const protocol = buildProtocol(service.sigla);
    let member = memberId ? await prisma.member.findUnique({ where: { id: memberId } }) : null;
    if (member && isRestrictedToOwnChurch(user) && user.churchId && member.churchId !== user.churchId) {
      return NextResponse.json({ error: "Perfil de igreja só pode vincular membros da própria igreja." }, { status: 403 });
    }
    let resolvedMemberId = memberId || null;
    if (!resolvedMemberId && candidateName && churchId) {
      const foundMember = await prisma.member.findFirst({ where: { churchId, deletedAt: null, fullName: { equals: candidateName.trim(), mode: "insensitive" } } });
      if (foundMember) { member = foundMember; resolvedMemberId = foundMember.id; }
    }
    // Readmissão: o título de retorno é confirmado pela secretaria na abertura
    // do requerimento e fica gravado no card. Quando o card for movido para a
    // coluna que troca o título, é este valor que a matriz aplica — sem depender
    // de deduzir nada do histórico legado. Ver src/lib/readmissaoTitulo.ts.
    let resolvedIntendedTitle: string | null = intendedTitle || null;
    if (ehServicoDeReadmissao(service)) {
      const trocaTitulo = await prisma.kanMatrixRule.findFirst({
        // Só a regra que restaura o título do passado depende da confirmação.
        // Uma regra de título fixo (a coluna de cancelamento, por exemplo) não
        // usa o título confirmado e não deve exigi-lo.
        where: { serviceId: service.id, isActive: true, changeTitle: true, restorePreviousTitle: true },
        select: { id: true },
      });
      if (trocaTitulo) {
        if (!resolvedIntendedTitle) {
          return NextResponse.json(
            {
              error: "Confirme o título de retorno antes de abrir a readmissão.",
              code: "TITULO_READMISSAO_NAO_CONFIRMADO",
            },
            { status: 400 }
          );
        }
        const doCatalogo = await normalizarTituloDoCatalogo(prisma, resolvedIntendedTitle);
        if (!doCatalogo) {
          return NextResponse.json(
            {
              error: `Título de retorno "${resolvedIntendedTitle}" não existe no catálogo de títulos.`,
              code: "TITULO_READMISSAO_INVALIDO",
            },
            { status: 400 }
          );
        }
        // Guarda o nome canônico: a base tem PRESBÍTERO e PRESBITERO convivendo.
        resolvedIntendedTitle = doCatalogo.nome;
      }
    }

    let resolvedOriginRegionalId = originRegionalId || null;
    if (!resolvedOriginRegionalId && churchId) {
      const originChurch = await prisma.church.findUnique({ where: { id: churchId }, select: { regionalId: true } });
      resolvedOriginRegionalId = originChurch?.regionalId || null;
    }
    let resolvedDestRegionalId = destinationRegionalId || null;
    if (!resolvedDestRegionalId && destinationChurchId) {
      const destChurch = await prisma.church.findUnique({ where: { id: destinationChurchId }, select: { regionalId: true } });
      resolvedDestRegionalId = destChurch?.regionalId || null;
    }

    const card = await prisma.kanCard.create({
      data: {
        protocol, stageId: stage.id, serviceId: service.id, columnId: firstColumn.id, columnIndex: 1, churchId,
        memberId: resolvedMemberId, destinationChurchId: destinationChurchId || null,
        originRegionalId: resolvedOriginRegionalId, destinationRegionalId: resolvedDestRegionalId,
        requesterChurchId: requesterChurchId || null, requestedChurchId: requestedChurchId || null,
        requesterName: requesterName || null, candidateName: candidateName || member?.fullName || null,
        currentTitle: member?.ecclesiasticalTitle || null, intendedTitle: resolvedIntendedTitle,
        subject: subject || null, justification: justification || null, observations: observations || null,
        description: description || null, status: "pendente", statusLabel: firstColumn.name,
        metadata: metadata || null, attachments: attachments || null, createdBy: user.id || null,
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, memberType: true } },
        service: { select: { sigla: true, description: true } },
      },
    });

    await applyMatrixRule({ card: card as unknown as Record<string, unknown>, serviceId: service.id, columnIndex: 1, user, extraMessage: justification });
    return NextResponse.json(serializeBigInts(card), { status: 201 });
  });
}
