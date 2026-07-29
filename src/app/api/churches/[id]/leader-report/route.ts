import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

const LEADER_SELECT = {
  id: true,
  fullName: true,
  rol: true,
  ecclesiasticalTitle: true,
  photoUrl: true,
  spouseName: true,
  phone: true,
  mobile: true,
} as const;

/**
 * Fonte única dos dois relatórios de dirigente: o card individual de "Troca de
 * Dirigente" e a listagem de "Histórico de Dirigentes".
 *
 * Devolve tudo o que o modal de configuração pode oferecer para o usuário marcar
 * — dados cadastrais da igreja, fotos do templo, fotos dos dirigentes e as
 * congregações da regional — mesmo que o layout padrão use só uma parte.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const church = await prisma.church.findFirst({
      where: { id: churchId, deletedAt: null },
      select: {
        id: true, name: true, code: true, plateName: true, hasOwnTemple: true,
        cnpj: true, documentType: true, documentNumber: true,
        email: true, phone: true, whatsapp: true, foundedAt: true,
        addressStreet: true, addressNumber: true, addressComplement: true,
        addressNeighborhood: true, addressCity: true, addressState: true, addressZipcode: true,
        currentLeaderName: true, currentLeaderRole: true, leaderRoll: true,
        regional: { select: { id: true, name: true, code: true, campo: { select: { id: true, name: true, code: true } } } },
        headquarters: { select: { id: true, churchName: true } },
      },
    });
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });

    const [records, photos, regionalChurches, memberCount, workerCount] = await Promise.all([
      prisma.churchLeaderHistory.findMany({
        where: { churchId },
        include: {
          previousLeaderMember: { select: LEADER_SELECT },
          newLeaderMember: { select: LEADER_SELECT },
          function: { select: { id: true, name: true } },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.legacyChurchPhoto.findMany({
        where: { churchId },
        orderBy: { createdAt: "desc" },
        select: { id: true, photoUrl: true, fieldName: true, createdAt: true },
      }),
      prisma.church.findMany({
        where: { regionalId: church.regional.id, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.member.count({ where: { churchId, deletedAt: null } }),
      prisma.churchFunctionHistory.count({ where: { churchId, deletedAt: null, endDate: null, isActive: true } }),
    ]);

    return NextResponse.json(
      serializeBigInts({
        church,
        records,
        photos,
        regionalChurches,
        // Usados quando a movimentação foi registrada sem informar os totais.
        counts: { members: memberCount, workers: workerCount },
        generatedAt: new Date().toISOString(),
        generatedBy: user.fullName || user.email || null,
      })
    );
  });
}
