import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas } from "@/lib/contasPagarScope";

/**
 * GET /api/credores/buscar-pj?q=texto
 *
 * Busca de pessoa jurídica para o cadastro de credor, para não redigitar nome
 * e CNPJ de quem a igreja já paga.
 *
 * Onde as PJs realmente moram neste sistema (levantado no banco em 13/08/2026):
 *
 *   - `members` com `fantasy_name` preenchido são as PJs de verdade: 126
 *     registros, com o documento em `cpf` (às vezes em `cnpj`). É a mesma fonte
 *     que a tela de Lançamento usa no "Buscar PJ existente".
 *   - `livro_caixa.id_favorecido_externo` guarda o **id desse membro**, não o
 *     CNPJ — 746 dos 1.044 lançamentos PJ apontam para um membro existente.
 *   - `livro_caixa.identificador` está NULO em 100% das linhas PJ. Não serve.
 *
 * Por isso a busca tem três origens, nesta ordem de confiança:
 *   1. credores PJ já cadastrados — evita cadastrar o mesmo fornecedor duas vezes
 *   2. membros-PJ (fantasy_name) — trazem nome e documento, e viram vínculo
 *   3. favorecido solto do histórico — só o texto, para PJ que nunca virou membro
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;
    const q = (sp.get("q") ?? "").trim();
    if (q.length < 3) return NextResponse.json([]);

    const escopo = escopoDeIgrejas(user, {
      churchId: sp.get("churchId") ?? undefined,
      regionalId: sp.get("regionalId") ?? undefined,
      campoId: sp.get("campoId") ?? undefined,
    });
    if (!escopo.ok) return NextResponse.json({ error: escopo.erro }, { status: 403 });

    const igrejas = await prisma.church.findMany({ where: escopo.churchWhere, select: { id: true } });
    if (!igrejas.length) return NextResponse.json([]);
    const churchIds = Prisma.join(igrejas.map((c) => Prisma.sql`${c.id}::uuid`));
    const como = `%${q}%`;

    const [jaCadastrados, membrosPj, doHistorico] = await Promise.all([
      prisma.credor.findMany({
        where: {
          deletedAt: null,
          tipoPessoa: "PJ",
          church: escopo.churchWhere,
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { cpfCnpj: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, nome: true, cpfCnpj: true, ativo: true },
        orderBy: { nome: "asc" },
        take: 15,
      }),
      prisma.$queryRaw<Array<{ id: string; nome: string; documento: string | null }>>`
        SELECT id::text AS id,
               COALESCE(NULLIF(fantasy_name, ''), full_name) AS nome,
               COALESCE(NULLIF(cnpj, ''), NULLIF(cpf, ''))   AS documento
        FROM members
        WHERE deleted_at IS NULL
          AND fantasy_name IS NOT NULL AND fantasy_name <> ''
          AND church_id IN (${churchIds})
          AND (full_name ILIKE ${como} OR fantasy_name ILIKE ${como}
               OR cpf ILIKE ${como} OR cnpj ILIKE ${como})
        ORDER BY nome
        LIMIT 20
      `,
      prisma.$queryRaw<Array<{ favorecido: string }>>`
        SELECT DISTINCT ON (upper(favorecido)) favorecido
        FROM livro_caixa
        WHERE church_id IN (${churchIds})
          AND tipo_pessoa = 'PJ'
          AND favorecido IS NOT NULL
          AND favorecido ILIKE ${como}
          AND deleted_at IS NULL
        ORDER BY upper(favorecido), data_lancamento DESC
        LIMIT 20
      `,
    ]);

    const chave = (s: string) => s.trim().toUpperCase();
    const vistos = new Set<string>();

    const resultado: Array<Record<string, unknown>> = [];
    for (const c of jaCadastrados) {
      vistos.add(chave(c.nome));
      resultado.push({
        origem: "credor", credorId: c.id, memberId: null,
        nome: c.nome, documento: c.cpfCnpj, ativo: c.ativo,
      });
    }
    for (const m of membrosPj) {
      if (vistos.has(chave(m.nome))) continue;
      vistos.add(chave(m.nome));
      resultado.push({
        origem: "membro", credorId: null, memberId: m.id,
        nome: m.nome, documento: m.documento, ativo: true,
      });
    }
    for (const h of doHistorico) {
      if (vistos.has(chave(h.favorecido))) continue;
      vistos.add(chave(h.favorecido));
      resultado.push({
        origem: "historico", credorId: null, memberId: null,
        nome: h.favorecido, documento: null, ativo: true,
      });
    }

    return NextResponse.json(serializeBigInts(resultado));
  });
}
