import { prisma } from "@/lib/prisma";
import { buildProtocol } from "@/lib/helpers";
import { applyMatrixRule, notifyKanAction } from "@/lib/kanMatrix";

/**
 * Abre (e opcionalmente já aprova) o card de Cadastro do membro novo.
 *
 * Todo caminho que cria membro precisa passar por aqui, senão o membro nasce
 * sem histórico e sem o título/status que a matriz define — foi exatamente o
 * que acontecia com o "Quero ser Membro", que gravava `ATIVO` na mão e nunca
 * chamava a matriz.
 *
 * `upToColumnIndex` decide onde o card para:
 *  - 1 → só abre em "Pendente" (fluxo do botão Novo Membro, que segue para
 *        aprovação manual no pipeline);
 *  - 2 → abre e já move para "Aprovado", aplicando as duas regras na ordem —
 *        é o que a aprovação da ficha faz, porque ali a secretaria já decidiu.
 *
 * Nunca lança: cadastro de membro não pode falhar por causa do pipeline.
 */
export async function openAdmissionCard({
  member,
  user,
  upToColumnIndex = 1,
  note,
}: {
  member: { id: string; churchId: string; fullName: string; ecclesiasticalTitle?: string | null };
  user: { id?: string | null; profileType?: string | null; campoId?: string | null };
  upToColumnIndex?: 1 | 2;
  note?: string | null;
}): Promise<{ cardId: string; protocol: string; columnIndex: number } | null> {
  try {
    const service = await prisma.kanService.findFirst({ where: { isActive: true, sigla: "CAD" } });
    if (!service) return null;

    // A etapa costuma vir pelo serviço; quando não vem, a própria regra da
    // matriz diz em qual stage ela mora.
    let stage = await prisma.kanStage.findFirst({
      where: { serviceId: service.id, isActive: true },
      include: { columns: { orderBy: { columnIndex: "asc" } } },
    });
    if (!stage?.columns?.length) {
      const rule = await prisma.kanMatrixRule.findFirst({
        where: { serviceId: service.id, columnIndex: 1, isActive: true },
        select: { stageId: true },
      });
      if (rule?.stageId) {
        stage = await prisma.kanStage.findUnique({
          where: { id: rule.stageId },
          include: { columns: { orderBy: { columnIndex: "asc" } } },
        });
      }
    }

    const primeira = stage?.columns.find((c) => c.columnIndex === 1);
    if (!stage || !primeira) return null;

    const card = await prisma.kanCard.create({
      data: {
        protocol: buildProtocol(service.sigla),
        stageId: stage.id,
        serviceId: service.id,
        columnId: primeira.id,
        columnIndex: 1,
        churchId: member.churchId,
        memberId: member.id,
        candidateName: member.fullName,
        currentTitle: member.ecclesiasticalTitle ?? null,
        status: "pendente",
        statusLabel: primeira.name,
        createdBy: user.id || null,
      },
    });

    await applyMatrixRule({
      card: card as unknown as Record<string, unknown>,
      serviceId: service.id,
      columnIndex: 1,
      user,
      extraMessage: note,
    });

    if (upToColumnIndex < 2) {
      return { cardId: card.id, protocol: card.protocol, columnIndex: 1 };
    }

    const aprovada = stage.columns.find((c) => c.columnIndex === 2);
    if (!aprovada) return { cardId: card.id, protocol: card.protocol, columnIndex: 1 };

    // Mesmos carimbos do PATCH /kan/cards/[id]: encerra só na última coluna.
    const movido = await prisma.kanCard.update({
      where: { id: card.id },
      data: {
        columnId: aprovada.id,
        columnIndex: 2,
        statusLabel: aprovada.name,
        status: "aprovado",
        approvedBy: user.id || null,
        approvedAt: new Date(),
        updatedBy: user.id || null,
        ...(aprovada.columnIndex === stage.columns.length ? { closedAt: new Date() } : {}),
      },
    });

    await applyMatrixRule({
      card: movido as unknown as Record<string, unknown>,
      serviceId: service.id,
      columnIndex: 2,
      user,
      extraMessage: note,
    });

    await notifyKanAction({
      user,
      card: { id: movido.id, protocol: movido.protocol, churchId: movido.churchId },
      action: `Movido para "${aprovada.name}"`,
      message: member.fullName,
    });

    return { cardId: movido.id, protocol: movido.protocol, columnIndex: 2 };
  } catch (e) {
    console.error("openAdmissionCard error:", e);
    return null;
  }
}
