import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, buildProtocol } from "@/lib/helpers";

async function applyMatrixRule({
  card,
  serviceId,
  columnIndex,
  user,
  extraMessage,
}: {
  card: Record<string, unknown>;
  serviceId: number;
  columnIndex: number;
  user: { id?: string; profileType?: string };
  extraMessage?: string | null;
}) {
  try {
    const rule = await prisma.kanMatrixRule.findUnique({
      where: { serviceId_columnIndex: { serviceId, columnIndex } },
    });
    if (!rule) return;

    const svc = await prisma.kanService.findUnique({ where: { id: serviceId } });
    const serviceGroup = svc?.serviceGroup || svc?.sigla || "GERAL";
    const serviceName = svc?.description || svc?.sigla || "";

    if (card.memberId && (rule.changeStatus || rule.changeTitle)) {
      const memberData: Record<string, unknown> = {};
      if (rule.changeStatus && rule.newStatus) memberData.membershipStatus = rule.newStatus.toUpperCase();
      if (rule.changeTitle && rule.newTitle) {
        memberData.ecclesiasticalTitle = rule.newTitle;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({
          where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true },
        });
        memberData.ecclesiasticalTitleId = titleRecord?.id ?? null;
      }
      if (Object.keys(memberData).length > 0) {
        await prisma.member.update({ where: { id: card.memberId as string }, data: memberData });
      }
    }

    if (rule.insertOccurrence !== false) {
      await prisma.memberEventHistory.create({
        data: {
          memberId: (card.memberId as string) || null,
          churchId: card.churchId as string,
          serviceGroup,
          serviceName,
          columnIndex,
          action: rule.occurrenceName || serviceName || "MOVIMENTO",
          notes: extraMessage || rule.message || null,
          metadata: { source: "MATRIX", cardId: card.id },
          cardId: card.id as string,
          createdBy: user?.id || null,
        },
      }).catch(() => null);
    }
  } catch (e) {
    console.error("applyMatrixRule (baptism) error:", e);
  }
}

/**
 * Batismo em águas acontece UMA vez por pessoa, então o membro entra no fluxo
 * uma vez só — nunca dois cards para o mesmo ROL.
 *
 * Se ele já entrou e o batismo não se concretizou (perdeu a data, ficou
 * pendente), o certo não é criar um card novo: é REINICIAR o que existe —
 * volta para a primeira coluna, recebe a data de batismo vigente e tem a data
 * de criação renovada, para reaparecer na lista dos próximos batizandos.
 *
 * Card cancelado ou reprovado não bloqueia: aquele processo foi encerrado e a
 * pessoa pode ser incluída de novo normalmente.
 */
const STATUS_QUE_NAO_BLOQUEIAM = new Set(["cancelado", "reprovado"]);

async function batismoExistente(memberId: string, serviceGroup = "BATISMO") {
  const cards = await prisma.kanCard.findMany({
    where: { memberId, deletedAt: null, service: { serviceGroup } },
    include: { service: { select: { id: true, sigla: true, description: true } } },
    orderBy: { createdAt: "desc" },
  });
  return cards.find((c) => !STATUS_QUE_NAO_BLOQUEIAM.has(String(c.status || "").toLowerCase())) ?? null;
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { memberId, baptismDate, notes, reiniciar } = body;
    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

    const member = await prisma.member.findFirst({
      where: { id: memberId, deletedAt: null },
      include: { church: { select: { id: true, name: true, code: true } } },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    // Find baptism service.
    // O grupo BATISMO tem mais de um servico ativo (BATISMO = "Batismo em Aguas" e
    // BAT = "Batismo (em outro Ministerio)"). Este modulo trata sempre do batismo em
    // aguas, entao a busca e explicita pela sigla — um findFirst sem criterio pegava
    // o servico errado e os cards saiam rotulados como "em outro Ministerio".
    const service =
      (await prisma.kanService.findFirst({
        where: { isActive: true, serviceGroup: "BATISMO", sigla: "BATISMO" },
      })) ||
      (await prisma.kanService.findFirst({
        where: { isActive: true, serviceGroup: "BATISMO" },
        orderBy: { id: "asc" },
      }));
    if (!service) return NextResponse.json({ error: "baptism service not configured" }, { status: 404 });

    // Find stage — by serviceId first, fallback to name
    let stage = await prisma.kanStage.findFirst({
      where: { serviceId: service.id, isActive: true },
      include: { columns: { where: { columnIndex: 1 }, take: 1 } },
      orderBy: { id: "asc" },
    });
    if (!stage || !stage.columns?.length) {
      const rule = await prisma.kanMatrixRule.findFirst({
        where: { serviceId: service.id, columnIndex: 1, isActive: true },
        orderBy: { id: "asc" },
        select: { stageId: true },
      });
      if (rule?.stageId) {
        stage = await prisma.kanStage.findUnique({
          where: { id: rule.stageId },
          include: { columns: { where: { columnIndex: 1 }, take: 1 } },
        });
      }
    }
    if (!stage) return NextResponse.json({ error: "baptism stage not configured" }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "stage has no first column" }, { status: 400 });

    // ── Duplicidade: um membro só entra no batismo uma vez ────────────────────
    const jaExiste = await batismoExistente(member.id);
    if (jaExiste && !reiniciar) {
      return NextResponse.json(
        {
          error: `${member.fullName} já está no processo de batismo.`,
          duplicado: true,
          existente: serializeBigInts({
            id: jaExiste.id,
            protocol: jaExiste.protocol,
            status: jaExiste.status,
            statusLabel: jaExiste.statusLabel,
            columnIndex: jaExiste.columnIndex,
            createdAt: jaExiste.createdAt,
            baptismDate: (jaExiste.metadata as Record<string, unknown> | null)?.baptismDate ?? null,
            serviceName: jaExiste.service?.description ?? jaExiste.service?.sigla ?? null,
          }),
        },
        { status: 409 }
      );
    }

    // ── Reiniciar: reaproveita o card em vez de criar outro ───────────────────
    if (jaExiste && reiniciar) {
      // A data vem do que foi informado ou da data de batismo vigente da igreja.
      const agendada = await prisma.$queryRaw<Array<{ scheduledDate: Date }>>`
        SELECT scheduled_date AS "scheduledDate"
        FROM baptism_schedules
        WHERE church_id = ${member.churchId}::uuid AND is_active = TRUE
        ORDER BY scheduled_date DESC
        LIMIT 1
      `;
      const dataFinal =
        baptismDate ||
        (agendada[0]?.scheduledDate ? agendada[0].scheduledDate.toISOString().slice(0, 10) : null);

      const metadataAtual = (jaExiste.metadata as Record<string, unknown> | null) ?? {};
      const reinicioAnterior = Number(metadataAtual.reinicios ?? 0);

      const reiniciado = await prisma.kanCard.update({
        where: { id: jaExiste.id },
        data: {
          stageId: stage.id,
          columnId: firstColumn.id,
          columnIndex: 1,
          status: "pendente",
          statusLabel: firstColumn.name,
          observations: notes || jaExiste.observations,
          // Renova a data de criação: é o que faz o card voltar a aparecer na
          // lista dos próximos batizandos, ordenada por inclusão.
          createdAt: new Date(),
          metadata: {
            ...metadataAtual,
            flowType: "batismo",
            baptismDate: dataFinal,
            reinicios: reinicioAnterior + 1,
            reiniciadoEm: new Date().toISOString(),
            reiniciadoPor: user.id || null,
          },
        },
        include: {
          church: { select: { id: true, name: true, code: true } },
          member: { select: { id: true, fullName: true, ecclesiasticalTitle: true } },
          service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
        },
      });

      // Fica no histórico do membro: reinício não é inclusão nova, mas também
      // não pode passar em branco na prestação de contas da secretaria.
      await prisma.memberEventHistory.create({
        data: {
          memberId: member.id,
          churchId: member.churchId,
          serviceGroup: "BATISMO",
          serviceName: service.description || service.sigla,
          columnIndex: 1,
          action: "Batismo reiniciado",
          notes: dataFinal ? `Nova data de batismo: ${dataFinal}` : "Sem data de batismo definida",
          metadata: { source: "BATISMO_REINICIO", cardId: reiniciado.id },
          cardId: reiniciado.id,
          createdBy: user.id || null,
        },
      }).catch(() => null);

      return NextResponse.json(
        serializeBigInts({ ok: true, card: reiniciado, reiniciado: true }),
        { status: 200 }
      );
    }

    const card = await prisma.kanCard.create({
      data: {
        protocol: buildProtocol(service.sigla),
        stageId: stage.id,
        serviceId: service.id,
        columnId: firstColumn.id,
        columnIndex: 1,
        churchId: member.churchId,
        memberId: member.id,
        candidateName: member.fullName,
        status: "pendente",
        statusLabel: firstColumn.name,
        observations: notes || null,
        description: notes || null,
        createdBy: user.id || null,
        metadata: { flowType: "batismo", baptismDate: baptismDate || null },
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true } },
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
      },
    });

    // Apply matrix rule for columnIndex=1 (triggers occurrence insertion)
    await applyMatrixRule({
      card: card as unknown as Record<string, unknown>,
      serviceId: service.id,
      columnIndex: 1,
      user,
      extraMessage: notes || null,
    });

    return NextResponse.json(serializeBigInts({ ok: true, card }), { status: 201 });
  });
}
