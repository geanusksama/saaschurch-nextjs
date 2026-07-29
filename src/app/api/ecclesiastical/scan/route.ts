import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import { serializeBigInts, isRestrictedToOwnChurch } from "@/lib/helpers";
import { applyMatrixRule, notifyKanAction } from "@/lib/kanMatrix";
import { UUID_RE, confirmBlockedReason, detectMode, normalizeCode, targetColumns } from "@/lib/scanRules";

/**
 * Leitor de QR Code da Secretaria — Batismo e Consagração.
 *
 * GET  ?code=<uuid|protocolo|url do QR>  → devolve os dados do card para conferência
 * POST { code, action: 'confirm' | 'abandon', notes? } → move o card de coluna
 *
 * O POST passa por applyMatrixRule, ou seja, o efeito é exatamente o mesmo de
 * arrastar o card no pipeline (muda status/título do membro e grava a ocorrência).
 * As regras de decisão (modo, coluna de destino, bloqueio) ficam em
 * @/lib/scanRules para o e2e exercitar o mesmo código.
 */

const CARD_INCLUDE = {
  church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true, campoId: true } } } },
  member: { select: { id: true, fullName: true, rol: true, phone: true, mobile: true, birthDate: true, photoUrl: true, ecclesiasticalTitle: true, membershipStatus: true } },
  service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
  column: { select: { id: true, name: true, columnIndex: true, color: true } },
  stage: { include: { columns: { orderBy: { columnIndex: "asc" as const } } } },
};

function assertScope(user: AuthUser, card: { churchId: string; church?: { regional?: { campoId?: string | null } | null } | null }) {
  if (user.profileType === "master") return null;
  if (!user.campoId || card.church?.regional?.campoId !== user.campoId) {
    return "Sem acesso a registros de outro campo.";
  }
  if (isRestrictedToOwnChurch(user)) {
    if (!user.churchId || card.churchId !== user.churchId) {
      return "Sem acesso a registros de outra igreja.";
    }
  }
  return null;
}

async function findCard(code: string) {
  if (UUID_RE.test(code)) {
    return prisma.kanCard.findUnique({ where: { id: code }, include: CARD_INCLUDE });
  }
  return prisma.kanCard.findFirst({
    where: { protocol: { equals: code, mode: "insensitive" }, deletedAt: null },
    include: CARD_INCLUDE,
    orderBy: { openedAt: "desc" },
  });
}

/** Card sem anexo em coluna que exige documento — mesma trava do pipeline. */
async function faltaDocumento(card: NonNullable<Awaited<ReturnType<typeof findCard>>>, columnIndex?: number) {
  if (columnIndex == null) return false;
  const rule = await prisma.kanMatrixRule.findUnique({
    where: { serviceId_columnIndex: { serviceId: card.serviceId, columnIndex } },
  });
  if (!rule?.requireDocument) return false;
  const anexos = card.attachments;
  const lista = Array.isArray(anexos) ? anexos : anexos ? Object.values(anexos) : [];
  return lista.length === 0;
}

async function toPayload(card: Awaited<ReturnType<typeof findCard>>) {
  if (!card) return null;
  const mode = detectMode(card.service);
  const columns = card.stage?.columns || [];
  const targets = mode
    ? targetColumns(mode, columns)
    : { confirm: null, abandon: null, requiredBefore: null };
  let blockedReason = mode ? confirmBlockedReason(mode, card, targets as ReturnType<typeof targetColumns>) : null;
  if (!blockedReason && targets.confirm && await faltaDocumento(card, targets.confirm.columnIndex)) {
    blockedReason = `A etapa "${targets.confirm.name}" exige documento anexado no processo.`;
  }
  return serializeBigInts({
    id: card.id,
    protocol: card.protocol,
    mode,
    member: card.member,
    church: card.church,
    service: card.service,
    column: card.column,
    columnIndex: card.columnIndex,
    statusLabel: card.statusLabel || card.column?.name || null,
    openedAt: card.openedAt,
    closedAt: card.closedAt,
    observations: card.observations,
    confirmLabel: targets.confirm?.name || null,
    abandonLabel: targets.abandon?.name || null,
    requiredStageLabel: targets.requiredBefore?.name || null,
    canConfirm: Boolean(targets.confirm) && !blockedReason,
    blockedReason,
    alreadyConfirmed: Boolean(targets.confirm && card.columnIndex === targets.confirm.columnIndex),
    alreadyAbandoned: Boolean(targets.abandon && card.columnIndex === targets.abandon.columnIndex),
  });
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const code = normalizeCode(req.nextUrl.searchParams.get("code") || "");
    if (!code) return NextResponse.json({ error: "Informe o código do QR." }, { status: 400 });

    const card = await findCard(code);
    if (!card || card.deletedAt) return NextResponse.json({ error: "Registro não encontrado para este QR Code." }, { status: 404 });

    const denied = assertScope(user, card);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });

    if (!detectMode(card.service)) {
      return NextResponse.json({ error: "Este QR Code não é de Batismo nem de Consagração." }, { status: 422 });
    }
    return NextResponse.json(await toPayload(card));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body: { code?: string; action?: string; mode?: string; notes?: string } =
      await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code || ""));
    const action = String(body.action || "");
    if (!code) return NextResponse.json({ error: "Informe o código do QR." }, { status: 400 });
    if (action !== "confirm" && action !== "abandon") {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const card = await findCard(code);
    if (!card || card.deletedAt) return NextResponse.json({ error: "Registro não encontrado para este QR Code." }, { status: 404 });

    const denied = assertScope(user, card);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });

    const mode = detectMode(card.service);
    if (!mode) return NextResponse.json({ error: "Este QR Code não é de Batismo nem de Consagração." }, { status: 422 });
    if (body.mode && body.mode !== mode) {
      return NextResponse.json({
        error: mode === "baptism"
          ? "Este QR Code é de Batismo — troque o leitor para Batismo."
          : "Este QR Code é de Consagração — troque o leitor para Consagração.",
      }, { status: 409 });
    }

    const columns = card.stage?.columns || [];
    const targets = targetColumns(mode, columns);
    const target = action === "confirm" ? targets.confirm : targets.abandon;
    if (!target) return NextResponse.json({ error: "Coluna de destino não configurada no pipeline." }, { status: 422 });

    if (action === "confirm") {
      const blocked = confirmBlockedReason(mode, card, targets);
      if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
    }

    // Mesma trava do arrasto no pipeline: coluna que exige documento não aceita
    // card sem anexo. Sem isto o leitor seria um atalho para furar a regra.
    const rule = await prisma.kanMatrixRule.findUnique({
      where: { serviceId_columnIndex: { serviceId: card.serviceId, columnIndex: target.columnIndex } },
    });
    if (rule?.requireDocument) {
      const anexos = card.attachments;
      const lista = Array.isArray(anexos) ? anexos : anexos ? Object.values(anexos) : [];
      if (!lista.length) {
        return NextResponse.json({ error: `A etapa "${target.name}" exige documento anexado no processo.` }, { status: 409 });
      }
    }

    if (card.columnIndex === target.columnIndex) {
      return NextResponse.json({
        alreadyDone: true,
        message: `Este registro já está em "${target.name}".`,
        card: await toPayload(card),
      });
    }

    // Espelha o PATCH /kan/cards/[id]: encerra só na última coluna do pipeline e
    // carimba a aprovação a partir da segunda. Divergir aqui faria o mesmo card
    // ficar diferente conforme tivesse sido movido pelo leitor ou pelo pipeline.
    const data: Record<string, unknown> = {
      columnId: target.id,
      columnIndex: target.columnIndex,
      statusLabel: target.name,
      updatedBy: user.id || null,
    };
    if (target.columnIndex === columns.length) data.closedAt = new Date();
    if (target.columnIndex >= 2) {
      data.approvedBy = user.id || null;
      data.approvedAt = new Date();
    }

    const updated = await prisma.kanCard.update({
      where: { id: card.id },
      data,
      include: CARD_INCLUDE,
    });

    const note = String(body.notes || "").trim()
      || (action === "confirm" ? "Confirmado pelo leitor de QR Code." : "Desistência registrada pelo leitor de QR Code.");

    await applyMatrixRule({
      card: updated as unknown as Record<string, unknown>,
      serviceId: updated.serviceId,
      columnIndex: target.columnIndex,
      user,
      extraMessage: note,
    });

    await notifyKanAction({
      user,
      card: { id: updated.id, protocol: updated.protocol, churchId: updated.churchId },
      action: `Movido para "${target.name}"`,
      message: updated.member?.fullName || null,
    });

    return NextResponse.json({
      ok: true,
      action,
      message: action === "confirm"
        ? `${updated.member?.fullName || updated.protocol} — ${target.name}.`
        : `${updated.member?.fullName || updated.protocol} — ${target.name}.`,
      card: await toPayload(updated),
    });
  });
}
