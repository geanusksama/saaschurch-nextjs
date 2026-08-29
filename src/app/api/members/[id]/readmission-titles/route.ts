import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";
import { historicoDeTitulos, ultimoTituloDoHistorico } from "@/lib/tituloEclesiasticoHistorico";
import {
  ehServicoDeReadmissao,
  escopoDoServico,
  tituloCabeNoEscopo,
  ROTULO_DO_ESCOPO,
} from "@/lib/readmissaoTitulo";

/**
 * Dados do modal de confirmação de título da readmissão.
 *
 * A tela chama isto assim que o serviço de readmissão é escolhido — na
 * ocorrência rápida e na abertura do requerimento — e mostra o histórico de
 * títulos do membro para a secretaria confirmar para qual deles ele volta.
 * Ver src/lib/readmissaoTitulo.ts.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullName: true, churchId: true, ecclesiasticalTitle: true, membershipStatus: true },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const serviceIdParam = req.nextUrl.searchParams.get("serviceId");
    const service = serviceIdParam
      ? await prisma.kanService.findUnique({
          where: { id: Number(serviceIdParam) },
          select: { id: true, sigla: true, description: true },
        })
      : null;

    const escopo = escopoDoServico(service);
    const [historico, sugerido, catalogo] = await Promise.all([
      historicoDeTitulos(prisma, id),
      ultimoTituloDoHistorico(prisma, id),
      prisma.ecclesiasticalTitle.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, level: true },
        orderBy: [{ level: "asc" }, { name: "asc" }],
      }),
    ]);

    // As regras da matriz dizem se este serviço realmente mexe no título — se
    // nenhuma mexer, não há o que confirmar e a tela não abre o modal.
    const regras = service
      ? await prisma.kanMatrixRule.findMany({
          where: { serviceId: service.id, isActive: true },
          select: { columnIndex: true, changeTitle: true, restorePreviousTitle: true, newTitle: true },
          orderBy: { columnIndex: "asc" },
        })
      : [];

    return NextResponse.json(
      serializeBigInts({
        member: {
          id: member.id,
          fullName: member.fullName,
          tituloAtual: member.ecclesiasticalTitle || null,
          situacao: member.membershipStatus || null,
        },
        service: service
          ? { id: service.id, sigla: service.sigla, description: service.description }
          : null,
        ehReadmissao: ehServicoDeReadmissao(service),
        escopo,
        escopoLabel: escopo ? ROTULO_DO_ESCOPO[escopo] : null,
        // Tudo que o membro já foi, do mais recente para o mais antigo. É a
        // lista que a secretaria olha para decidir.
        historico: historico.map((t) => ({
          nome: t.nome,
          level: t.level,
          quando: t.quando,
          noEscopo: tituloCabeNoEscopo(t.level, escopo),
        })),
        // O que o sistema aplicaria sozinho hoje — mostrado como sugestão, não
        // como decisão.
        sugerido: sugerido ? { nome: sugerido.nome, level: sugerido.level, quando: sugerido.quando } : null,
        // Catálogo para quem precisa escolher um título que não está no
        // histórico (o legado tem buracos). Já recortado pelo serviço.
        catalogo: catalogo
          .filter((t) => tituloCabeNoEscopo(Number(t.level), escopo))
          .map((t) => ({ nome: t.name, level: Number(t.level) })),
        exigeConfirmacao:
          ehServicoDeReadmissao(service) &&
          regras.some((r) => r.changeTitle && r.restorePreviousTitle),
        regras,
      })
    );
  });
}
