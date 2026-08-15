import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverTituloDaRegra } from "@/lib/tituloEclesiasticoHistorico";
import { ROTA_PIPELINE_SECRETARIA } from "@/lib/notificationLinks";

/**
 * Aplica a regra da matriz (kan_matrix_rules) ao mover um card de coluna.
 *
 * Extraído de /api/kan/cards/[id] para poder ser reaproveitado por fluxos que
 * movem cards fora do pipeline — hoje o leitor de QR Code de Batismo e
 * Consagração (/api/ecclesiastical/scan). Qualquer caminho que mude a coluna de
 * um card precisa passar por aqui, senão o membro não recebe título/status nem
 * a ocorrência no histórico.
 */
export async function applyMatrixRule({
  card,
  serviceId,
  columnIndex,
  user,
  extraMessage,
}: {
  card: Record<string, unknown>;
  serviceId: number;
  columnIndex: number;
  user: { id?: string | null };
  extraMessage?: string | null;
}) {
  try {
    const rule = await prisma.kanMatrixRule.findUnique({ where: { serviceId_columnIndex: { serviceId, columnIndex } } });
    if (!rule) return;
    const service = (card.service as Record<string, string> | null) || await prisma.kanService.findUnique({ where: { id: serviceId } });
    const serviceGroup = (service as Record<string, string> | null)?.serviceGroup || (service as Record<string, string> | null)?.sigla || "GERAL";
    const serviceName = (service as Record<string, string> | null)?.description || (service as Record<string, string> | null)?.sigla || "";
    if (card.memberId && (rule.changeStatus || rule.changeTitle || rule.doesTransfer)) {
      const memberData: Record<string, unknown> = {};
      let prevMember: { ecclesiasticalTitle: string | null; addressCity: string | null; addressState: string | null; nationality: string | null } | null = null;
      if (rule.changeStatus && rule.newStatus) memberData.membershipStatus = rule.newStatus.toUpperCase();

      // O título pode ser fixo (rule.newTitle) ou restaurado do histórico do
      // membro, quando a regra tem restorePreviousTitle — é o caso da
      // readmissão, em que quem já foi pastor não pode voltar como congregado.
      const { titulo: tituloResolvido, restaurado } = await resolverTituloDaRegra(
        prisma,
        rule,
        card.memberId as string
      );

      if (rule.changeTitle && tituloResolvido) {
        prevMember = await prisma.member.findUnique({ where: { id: card.memberId as string }, select: { ecclesiasticalTitle: true, addressCity: true, addressState: true, nationality: true } });
        memberData.ecclesiasticalTitle = tituloResolvido;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({ where: { name: { equals: tituloResolvido, mode: "insensitive" }, deletedAt: null, isActive: true } });
        memberData.ecclesiasticalTitleId = titleRecord?.id ?? null;
      }
      if (rule.doesTransfer && card.destinationChurchId) {
        const destChurch = await prisma.church.findUnique({
          where: { id: card.destinationChurchId as string },
          select: { regionalId: true }
        });
        if (destChurch) {
          memberData.churchId = card.destinationChurchId;
          memberData.regionalId = destChurch.regionalId ?? null;
        }
      }
      if (Object.keys(memberData).length > 0) await prisma.member.update({ where: { id: card.memberId as string }, data: memberData });
      if (rule.changeTitle && tituloResolvido) {
        await prisma.memberTitleHistory.create({
          data: {
            memberId: card.memberId as string,
            churchId: card.churchId as string,
            cardId: card.id ? card.id as string : null,
            previousTitle: prevMember?.ecclesiasticalTitle ?? null,
            newTitle: tituloResolvido,
            // Deixa rastro de que o título foi restaurado, e não escolhido na
            // regra — a secretaria precisa saber de onde veio numa conferência.
            source: restaurado ? "MATRIZ_RESTAURADO" : "MATRIZ",
            serviceGroup,
            serviceName,
            memberCity: prevMember?.addressCity ?? null,
            memberState: prevMember?.addressState ?? null,
            memberCountry: prevMember?.nationality ?? null,
            notes: restaurado
              ? `Título restaurado do histórico: ${restaurado.nome}${restaurado.quando ? ` (registrado em ${new Date(restaurado.quando).toLocaleDateString("pt-BR")})` : ""}`
              : rule.message ?? null,
            createdBy: user?.id ?? null,
          },
        }).catch(() => null);
      }
    }
    if (rule.insertOccurrence !== false) {
      await prisma.memberEventHistory.create({
        data: {
          memberId: (card.memberId as string) || null, churchId: card.churchId as string,
          serviceGroup, serviceName, columnIndex,
          action: rule.occurrenceName || serviceName || "MOVIMENTO",
          notes: extraMessage || rule.message || null,
          metadata: { source: "MATRIX", cardId: card.id } as Prisma.InputJsonValue,
          cardId: card.id as string,
          createdBy: user?.id || null,
        },
      }).catch(() => null);
    }
  } catch (e) { console.error("applyMatrixRule error:", e); }
}

/**
 * Notificação de movimento de card, no mesmo formato do pipeline.
 *
 * Também extraída de /api/kan/cards/[id]: quem acompanha a secretaria precisa
 * ver o aviso independente de o card ter sido arrastado na tela ou confirmado
 * pelo leitor de QR Code.
 */
export async function notifyKanAction({
  user,
  card,
  action,
  message,
}: {
  user: { id?: string | null; profileType?: string | null; campoId?: string | null };
  card: { id: string; protocol?: string | null; churchId?: string | null };
  action: string;
  message?: string | null;
}) {
  if (!user?.id) return;
  try {
    await prisma.notification.create({
      data: {
        userId: user.id,
        notificationType: "kan_action",
        title: `${action} — ${card?.protocol || card?.id || ""}`.trim(),
        message: message || null,
        actionUrl: ROTA_PIPELINE_SECRETARIA,
        actionText: "Ver",
        data: {
          scope: "field",
          campoId: user.campoId || null,
          createdBy: user.id,
          cardId: card?.id || null,
          churchId: card?.churchId || null,
          action,
          iconKey: "bell",
          colorKey: "purple",
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) { console.warn("notifyKanAction failed:", e); }
}
