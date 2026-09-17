import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas, podeAcessarIgreja } from "@/lib/contasPagarScope";
import { STATUS_LIVRE, STATUS_USADO } from "@/lib/dizimoNumeracao";

const PAGE_SIZE_MAX = 300;

/**
 * GET /api/dizimo-blocos/igrejas — a visão por igreja: quantos blocos ela tem,
 * quantos números sobraram e se a exigência está ligada.
 *
 * SÓ IGREJA COM BLOCO ATIVO. Sem esse filtro a lista virava a relação inteira
 * do campo — 200 e tantas linhas zeradas, com o switch travado em todas elas,
 * porque exigir numeração de quem não tem talão é justamente o que a rota
 * PATCH recusa. O que sobrava era rolagem, não informação.
 *
 * Existe separada da lista de blocos porque aqui a unidade é a IGREJA: uma que
 * tenha três talões aparece uma vez, com o total somado e um switch só.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;

    const escopo = escopoDeIgrejas(user, {
      churchId: sp.get("churchId") ?? undefined,
      regionalId: sp.get("regionalId") ?? undefined,
      campoId: sp.get("campoId") ?? undefined,
    });
    if (!escopo.ok) return NextResponse.json({ error: escopo.erro }, { status: 403 });

    const where: Record<string, unknown> = {
      ...escopo.churchWhere,
      // O filtro que dá nome à aba. Bloco inativo não conta: ele foi tirado de
      // circulação, e a igreja que só tem inativos não está mais numerando.
      dizimoBlocos: { some: { ativo: true, deletedAt: null } },
    };

    // Nome e código, como na aba de blocos: é o mesmo campo de busca da tela.
    // A busca ESTREITA esta lista, não escapa dela — procurar uma igreja sem
    // talão aqui não traz nada, e é o certo: a aba é "igrejas com blocos".
    const q = (sp.get("q") ?? "").trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ];
    }

    // 20 por página: são poucas igrejas com talão, e a página curta deixa a
    // resposta rápida mesmo com o groupBy de números que vem logo abaixo.
    const pagina = Math.max(1, Number(sp.get("pagina") ?? 1) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize") ?? 20) || 20));

    const [igrejas, total] = await Promise.all([
      prisma.church.findMany({
        where,
        orderBy: [{ name: "asc" }],
        skip: (pagina - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, code: true,
          regional: { select: { id: true, name: true } },
          dizimoNumeracaoConfig: { select: { exige: true } },
          // Conta só os ativos, o mesmo critério do filtro acima: mostrar
          // "3 blocos" numa igreja cujos três estão inativos contradiria a
          // própria lista em que a linha aparece.
          //
          // Chegou a virar um `groupBy` separado para "economizar" — medido em
          // 6 rodadas alternadas contra o banco de referência, a diferença foi
          // de 29 ms com as faixas se sobrepondo, ou seja, ruído. Voltou para
          // cá porque é a forma mais curta. O custo desta tela é ida e volta
          // de rede (~845 ms por chamada daqui), não a consulta: o Postgres
          // resolve cada uma em ~0,1 ms segundo o EXPLAIN ANALYZE.
          _count: { select: { dizimoBlocos: { where: { ativo: true, deletedAt: null } } } },
        },
      }),
      prisma.church.count({ where }),
    ]);

    // Livres e usados por igreja num groupBy só — um count por linha viraria
    // dezenas de consultas numa tela de campo inteiro.
    const ids = igrejas.map((c) => c.id);
    const contagem = ids.length
      ? await prisma.dizimoNumero.groupBy({
          by: ["churchId", "status"],
          where: { churchId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const porIgreja = new Map<string, { livres: number; usados: number }>();
    for (const linha of contagem) {
      const atual = porIgreja.get(linha.churchId) ?? { livres: 0, usados: 0 };
      if (linha.status === STATUS_LIVRE) atual.livres += linha._count._all;
      else if (linha.status === STATUS_USADO) atual.usados += linha._count._all;
      porIgreja.set(linha.churchId, atual);
    }

    const data = igrejas.map((c) => {
      const n = porIgreja.get(c.id) ?? { livres: 0, usados: 0 };
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        regional: c.regional,
        exigeNumeracao: c.dizimoNumeracaoConfig?.exige ?? false,
        blocos: c._count.dizimoBlocos,
        livres: n.livres,
        usados: n.usados,
      };
    });

    return NextResponse.json(serializeBigInts({ data, total, pagina, pageSize }));
  });
}

/**
 * PATCH /api/dizimo-blocos/igrejas — liga/desliga a exigência do número.
 *
 * Ligar sem bloco cadastrado é recusado: o tesoureiro ficaria com um campo
 * obrigatório que nenhum número satisfaz, e a igreja pararia de lançar dízimo.
 */
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

    const churchId = String(body.churchId ?? "").trim();
    const exige = Boolean(body.exige);
    if (!churchId) return NextResponse.json({ error: "Informe a igreja." }, { status: 400 });

    if (!(await podeAcessarIgreja(user, churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    if (exige) {
      const livres = await prisma.dizimoNumero.count({
        where: { churchId, status: STATUS_LIVRE, bloco: { ativo: true, deletedAt: null } },
      });
      if (livres === 0) {
        return NextResponse.json(
          {
            error:
              "Esta igreja não tem número livre em nenhum bloco ativo. Cadastre o bloco antes de exigir a numeração — senão a tesouraria dela para de lançar dízimo.",
          },
          { status: 409 }
        );
      }
    }

    const config = await prisma.dizimoNumeracaoConfig.upsert({
      where: { churchId },
      create: { churchId, exige, updatedBy: user.id },
      update: { exige, updatedBy: user.id },
      select: { churchId: true, exige: true },
    });

    return NextResponse.json(serializeBigInts(config));
  });
}
