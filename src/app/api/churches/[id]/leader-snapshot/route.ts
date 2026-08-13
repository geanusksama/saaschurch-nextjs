import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess, serializeBigInts } from "@/lib/helpers";

/**
 * GET /api/churches/[id]/leader-snapshot?date=YYYY-MM-DD
 *
 * O retrato da igreja na data da posse, para preencher o bloco "Resumo da
 * transição" do modal de Troca de Dirigente. Antes disso, os seis números eram
 * digitados à mão apesar de já existirem no banco.
 *
 * Recorte de cada número:
 *
 *   caixa atual   Σ RECEITA − Σ DESPESA da igreja até a data (inclusive),
 *                 só lançamentos válidos (situacao = true, deleted_at nulo).
 *   maior entrada maior RECEITA individual nos 12 meses anteriores à data.
 *   média entrada Σ RECEITA dos 12 meses ÷ nº de meses COM movimento. Dividir
 *                 por 12 fixo achataria a média de igreja nova ou de período
 *                 com meses sem lançamento — o que a secretaria quer é a média
 *                 dos meses em que houve movimento.
 *   média saída   idem para DESPESA.
 *   membros       members da igreja, deleted_at nulo.
 *   obreiros      membros com TÍTULO ECLESIÁSTICO de obreiro — ver abaixo.
 *
 * Como "obreiro" é definido (e por que não é do jeito óbvio):
 *
 *   - Não usa `church_function_history`: aquilo é função administrativa
 *     (dirigente, líder de jovens) e vive quase vazia — dava total 0.
 *   - Não usa `members.ecclesiastical_title_id`: a FK está preenchida em
 *     159 de 26.158 membros. O dado real está na coluna de TEXTO
 *     `members.ecclesiastical_title`.
 *   - Não usa a flag `is_ecclesiastical_minister` do catálogo: ela está
 *     inconsistente na base (PASTOR = false, PASTORA = true, BISPO = false).
 *   - Usa o `level` do catálogo, que é coerente: CONGREGADO e MEMBRO são
 *     nível 0; COOPERADOR 1, DIÁCONO/DIACONISA 2, PRESBÍTERO 3,
 *     EVANGELISTA/MISSIONÁRIO 4, PASTOR 5, BISPO 47. Obreiro = **nível >= 1**,
 *     ou seja, quem foi consagrado a alguma função ministerial.
 *
 * O casamento entre o texto do membro e o nome do catálogo é feito sem acento
 * e sem caixa, porque a base tem PRESBÍTERO/PRESBITERO e DIÁCONO/DIACONO
 * convivendo.
 *
 * Título que não existe no catálogo (DIACONIZA, "PASTOR PRESIDENTE",
 * lixo de digitação) NÃO entra no total: não dá para afirmar que é obreiro.
 * Ele volta em `titulosForaDoCatalogo` para a secretaria ver e corrigir o
 * cadastro — silenciar seria esconder um erro de dado.
 *
 * A contagem de membros usa a mesma regra de /leader-report, para que o modal
 * e o relatório impresso não discordem.
 */

/** Tira acento e caixa, para casar o texto do membro com o nome do catálogo. */
const SEM_ACENTO = `upper(translate(%s, 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç', 'AAAAEEIOOOUUCAAAAEEIOOOUUC'))`;

/** Nível a partir do qual o título caracteriza obreiro (0 = congregado/membro). */
const NIVEL_MINIMO_OBREIRO = 1;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    if (!(await assertChurchAccess(user, churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const dataRef = (sp.get("date") || new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRef)) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const [caixa, janela, membros, obreiros] = await Promise.all([
      // Saldo acumulado até a data.
      prisma.$queryRaw<Array<{ receitas: number | null; despesas: number | null; lancamentos: number }>>`
        SELECT
          COALESCE(SUM(valor) FILTER (WHERE tipo = 'RECEITA'), 0)::float8 AS receitas,
          COALESCE(SUM(valor) FILTER (WHERE tipo = 'DESPESA'), 0)::float8 AS despesas,
          COUNT(*)::int AS lancamentos
        FROM livro_caixa
        WHERE church_id = ${churchId}::uuid
          AND deleted_at IS NULL
          AND situacao = true
          AND data_lancamento <= ${dataRef}::date
      `,
      // Últimos 12 meses: maior entrada e médias por mês com movimento.
      prisma.$queryRaw<Array<{
        maior_entrada: number | null;
        total_receita: number | null;
        total_despesa: number | null;
        meses_receita: number;
        meses_despesa: number;
      }>>`
        SELECT
          COALESCE(MAX(valor) FILTER (WHERE tipo = 'RECEITA'), 0)::float8 AS maior_entrada,
          COALESCE(SUM(valor) FILTER (WHERE tipo = 'RECEITA'), 0)::float8 AS total_receita,
          COALESCE(SUM(valor) FILTER (WHERE tipo = 'DESPESA'), 0)::float8 AS total_despesa,
          COUNT(DISTINCT date_trunc('month', data_lancamento))
            FILTER (WHERE tipo = 'RECEITA')::int AS meses_receita,
          COUNT(DISTINCT date_trunc('month', data_lancamento))
            FILTER (WHERE tipo = 'DESPESA')::int AS meses_despesa
        FROM livro_caixa
        WHERE church_id = ${churchId}::uuid
          AND deleted_at IS NULL
          AND situacao = true
          AND data_lancamento <= ${dataRef}::date
          AND data_lancamento > (${dataRef}::date - INTERVAL '12 months')
      `,
      prisma.member.count({ where: { churchId, deletedAt: null } }),
      // Distribuição dos membros por título eclesiástico, já casada com o
      // catálogo. Devolve TODOS os títulos (inclusive nível 0 e fora do
      // catálogo) — o total de obreiros e o detalhamento do modal saem daqui.
      prisma.$queryRaw<Array<{
        titulo: string | null;
        nivel: number | null;
        total: number;
        no_catalogo: boolean;
        ordem: number | null;
      }>>`
        WITH catalogo AS (
          SELECT ${Prisma.raw(SEM_ACENTO.replace("%s", "name"))} AS chave,
                 name, level, display_order
          FROM ecclesiastical_titles
          WHERE deleted_at IS NULL
        ),
        membros AS (
          SELECT ${Prisma.raw(SEM_ACENTO.replace("%s", "COALESCE(ecclesiastical_title, '')"))} AS chave
          FROM members
          WHERE church_id = ${churchId}::uuid AND deleted_at IS NULL
        )
        SELECT COALESCE(c.name, NULLIF(m.chave, '')) AS titulo,
               c.level                               AS nivel,
               COUNT(*)::int                         AS total,
               (c.name IS NOT NULL)                  AS no_catalogo,
               c.display_order                       AS ordem
        FROM membros m
        LEFT JOIN catalogo c ON c.chave = m.chave
        GROUP BY c.name, c.level, c.display_order, m.chave
        ORDER BY c.level DESC NULLS LAST, total DESC
      `,
    ]);

    const c = caixa[0] ?? { receitas: 0, despesas: 0, lancamentos: 0 };
    const j = janela[0] ?? {
      maior_entrada: 0, total_receita: 0, total_despesa: 0, meses_receita: 0, meses_despesa: 0,
    };

    // Obreiro = título do catálogo com nível >= 1. Título fora do catálogo fica
    // de fora do total e volta separado, para a secretaria corrigir o cadastro.
    const porTitulo = obreiros.map((r) => ({
      titulo: r.titulo ?? "Sem título informado",
      nivel: r.nivel,
      total: Number(r.total),
      noCatalogo: r.no_catalogo,
      ehObreiro: r.no_catalogo && Number(r.nivel ?? 0) >= NIVEL_MINIMO_OBREIRO,
    }));

    const totalObreiros = porTitulo
      .filter((t) => t.ehObreiro)
      .reduce((soma, t) => soma + t.total, 0);

    const arredonda = (v: number) => Math.round(v * 100) / 100;
    const media = (total: number | null, meses: number) => (meses > 0 ? arredonda((total ?? 0) / meses) : null);

    // Sem lançamento no período, devolve null em vez de zero: zero é uma
    // afirmação ("a igreja não movimentou nada"), null é a ausência de dado —
    // e o modal mostra o campo vazio para a secretaria preencher.
    const temMovimento = Number(c.lancamentos) > 0;

    return NextResponse.json(
      serializeBigInts({
        date: dataRef,
        currentCash: temMovimento ? arredonda((c.receitas ?? 0) - (c.despesas ?? 0)) : null,
        maxIncome: j.meses_receita > 0 ? arredonda(j.maior_entrada ?? 0) : null,
        averageIncome: media(j.total_receita, j.meses_receita),
        averageExpense: media(j.total_despesa, j.meses_despesa),
        totalMembers: membros,
        totalWorkers: totalObreiros,
        /** Detalhamento do modal "Total de obreiros", já ordenado por nível. */
        obreirosPorTitulo: porTitulo.filter((t) => t.ehObreiro),
        /** Membros e congregados — nível 0. Mostrado como contexto no modal. */
        naoObreirosPorTitulo: porTitulo.filter((t) => t.noCatalogo && !t.ehObreiro),
        /** Títulos digitados que não existem no catálogo — cadastro a corrigir. */
        titulosForaDoCatalogo: porTitulo.filter((t) => !t.noCatalogo),
        origem: {
          lancamentos: Number(c.lancamentos),
          mesesComReceita: j.meses_receita,
          mesesComDespesa: j.meses_despesa,
          criterioObreiro: `Título eclesiástico de nível >= ${NIVEL_MINIMO_OBREIRO}`,
        },
      })
    );
  });
}
